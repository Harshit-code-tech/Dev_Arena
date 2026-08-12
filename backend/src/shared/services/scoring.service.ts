import type { Prisma, ScoreCategory } from "@prisma/client";
import { formatDateKey, getWeekStart } from "../utils/tracking";

const RANKS = [
    { name: "Unranked", points: 0 },
    { name: "Mud", points: 100 },
    { name: "Wood", points: 175 },
    { name: "Stone", points: 250 },
    { name: "Iron", points: 350 },
    { name: "Silver", points: 475 },
    { name: "Gold", points: 625 },
    { name: "Platinum", points: 800 },
    { name: "Ruby", points: 1000 },
    { name: "Diamond", points: 1250 },
    { name: "Developer", points: 1500 },
] as const;

type ScoreEventInput = {
    userId: string;
    category: ScoreCategory;
    sourceType: string;
    sourceId: string;
    label: string;
    points: number;
    occurredAt: Date;
};

export async function upsertScoreEvent(
    tx: Prisma.TransactionClient,
    input: ScoreEventInput,
) {
    await tx.scoreEvent.upsert({
        where: {
            userId_sourceType_sourceId: {
                userId: input.userId,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
            },
        },
        create: input,
        update: {
            category: input.category,
            label: input.label,
            points: input.points,
            occurredAt: input.occurredAt,
        },
    });
}

export async function removeScoreEvent(
    tx: Prisma.TransactionClient,
    userId: string,
    sourceType: string,
    sourceId: string,
) {
    await tx.scoreEvent.deleteMany({
        where: { userId, sourceType, sourceId },
    });
}

export async function rebuildUserScoreState(
    tx: Prisma.TransactionClient,
    userId: string,
) {
    const user = await tx.user.findUnique({
        where: { id: userId },
        select: { seasonStartDate: true },
    });

    if (!user) return;

    const [events, challengeResults] = await Promise.all([
        tx.scoreEvent.findMany({
            where: { userId },
            orderBy: { occurredAt: "asc" },
        }),
        tx.challengeResult.findMany({
            where: { userId },
            select: { id: true, score: true, weekStart: true },
        }),
    ]);

    const challengeTotal = challengeResults.reduce((sum, result) => sum + result.score, 0);
    const eventTotal = events.reduce((sum, event) => sum + event.points, 0);
    const seasonEventPoints = events
        .filter((event) => event.occurredAt >= user.seasonStartDate)
        .reduce((sum, event) => sum + event.points, 0);
    const seasonChallengePoints = challengeResults
        .filter((result) => result.weekStart >= user.seasonStartDate)
        .reduce((sum, result) => sum + result.score, 0);

    const seasonPoints = Math.max(seasonEventPoints + seasonChallengePoints, 0);
    const arenaScore = Math.max(eventTotal + challengeTotal, 0);
    const seasonDates = new Set(
        events
            .filter((event) => event.occurredAt >= user.seasonStartDate)
            .map((event) => formatDateKey(event.occurredAt)),
    );
    const allDates = new Set(events.map((event) => formatDateKey(event.occurredAt)));
    const streak = calculateStreak(allDates);
    const rank = rankForPoints(seasonPoints);

    await tx.user.update({
        where: { id: userId },
        data: {
            activeDays: seasonDates.size,
            arenaScore,
            rank,
            seasonPoints,
            streak,
        },
    });

    await tx.activity.deleteMany({ where: { userId } });
    if (allDates.size > 0) {
        await tx.activity.createMany({
            data: Array.from(allDates).map((date) => ({
                userId,
                date: new Date(`${date}T00:00:00.000Z`),
                isActive: true,
            })),
        });
    }

    await rebuildWeeklyScores(tx, userId, events, challengeResults);

    await tx.realtimeEvent.createMany({
        data: [
            {
                userId,
                type: "activity.changed",
                entityType: "score",
                entityId: userId,
                payload: { arenaScore, seasonPoints, rank, streak, activeDays: seasonDates.size },
            },
            {
                userId: null,
                type: "leaderboard.changed",
                entityType: "score",
                entityId: userId,
                payload: { userId },
            },
        ],
    });
}

async function rebuildWeeklyScores(
    tx: Prisma.TransactionClient,
    userId: string,
    events: Array<{ category: ScoreCategory; points: number; occurredAt: Date }>,
    challengeResults: Array<{ score: number; weekStart: Date }>,
) {
    const weeks = new Map<string, {
        weekStart: Date;
        dsaPoints: number;
        fullstackPoints: number;
        projectPoints: number;
        practicePoints: number;
        generalPoints: number;
        challengePoints: number;
        activeDates: Set<string>;
    }>();

    const getWeek = (date: Date) => {
        const weekStart = getWeekStart(date);
        const key = formatDateKey(weekStart);
        let week = weeks.get(key);
        if (!week) {
            week = {
                weekStart,
                dsaPoints: 0,
                fullstackPoints: 0,
                projectPoints: 0,
                practicePoints: 0,
                generalPoints: 0,
                challengePoints: 0,
                activeDates: new Set<string>(),
            };
            weeks.set(key, week);
        }
        return week;
    };

    for (const event of events) {
        const week = getWeek(event.occurredAt);
        week.activeDates.add(formatDateKey(event.occurredAt));
        if (event.category === "DSA") week.dsaPoints += event.points;
        if (event.category === "Fullstack") week.fullstackPoints += event.points;
        if (event.category === "Project") week.projectPoints += event.points;
        if (event.category === "Practice") week.practicePoints += event.points;
        if (event.category === "General") week.generalPoints += event.points;
        if (event.category === "Challenge") week.challengePoints += event.points;
    }

    for (const result of challengeResults) {
        const week = getWeek(result.weekStart);
        week.challengePoints += result.score;
    }

    await tx.weeklyScore.deleteMany({ where: { userId } });
    if (weeks.size === 0) return;

    await tx.weeklyScore.createMany({
        data: Array.from(weeks.values()).map((week) => ({
            userId,
            weekStart: week.weekStart,
            dsaPoints: week.dsaPoints,
            fullstackPoints: week.fullstackPoints,
            projectPoints: week.projectPoints,
            practicePoints: week.practicePoints,
            generalPoints: week.generalPoints,
            challengePoints: week.challengePoints,
            totalScore:
                week.dsaPoints +
                week.fullstackPoints +
                week.projectPoints +
                week.practicePoints +
                week.generalPoints +
                week.challengePoints,
            activeDays: week.activeDates.size,
        })),
    });
}

function rankForPoints(points: number) {
    let rank: string = RANKS[0].name;
    for (const candidate of RANKS) {
        if (points >= candidate.points) rank = candidate.name;
    }
    return rank;
}

function calculateStreak(activityDates: Set<string>) {
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);

    // A streak remains alive throughout the current day. If the user has not
    // logged today yet, count backwards from yesterday instead of displaying 0.
    if (!activityDates.has(formatDateKey(cursor))) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    let streak = 0;
    while (activityDates.has(formatDateKey(cursor))) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return streak;
}
