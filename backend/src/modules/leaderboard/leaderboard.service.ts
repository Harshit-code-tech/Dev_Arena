import { prisma } from "../../database/prisma";
import { getCurrentSeasonWindow } from "../../shared/config/season";
import { TrackingError, formatDateKey } from "../../shared/utils/tracking";
import type {
    LeaderboardNearbyResponse,
    LeaderboardResponse,
    LeaderboardSearchResponse,
    LeaderboardUser,
} from "./leaderboard.types";

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

const userSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    avatarUrl: true,
    useInitials: true,
    arenaScore: true,
} as const;

function roundTwo(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rankForPoints(points: number) {
    let rank: string = RANKS[0].name;
    for (const candidate of RANKS) {
        if (points >= candidate.points) rank = candidate.name;
    }
    return rank;
}

/**
 * The main DevArena leaderboard is a live universal-season leaderboard.
 * Challenge/tournament leaderboards stay separate in their own modules.
 */
async function getOrderedResults(currentUserId: string): Promise<LeaderboardUser[]> {
    const season = getCurrentSeasonWindow();
    const [users, scoreEvents, challengeResults] = await Promise.all([
        prisma.user.findMany({ select: userSelect }),
        prisma.scoreEvent.findMany({
            where: { occurredAt: { gte: season.start, lt: season.end } },
            select: { userId: true, points: true, occurredAt: true },
        }),
        prisma.challengeResult.findMany({
            where: { weekStart: { gte: season.start, lt: season.end } },
            select: { userId: true, score: true },
        }),
    ]);

    const pointsByUser = new Map<string, number>();
    const activeDatesByUser = new Map<string, Set<string>>();

    for (const event of scoreEvents) {
        pointsByUser.set(event.userId, (pointsByUser.get(event.userId) || 0) + event.points);
        let dates = activeDatesByUser.get(event.userId);
        if (!dates) {
            dates = new Set<string>();
            activeDatesByUser.set(event.userId, dates);
        }
        dates.add(formatDateKey(event.occurredAt));
    }

    for (const result of challengeResults) {
        pointsByUser.set(result.userId, (pointsByUser.get(result.userId) || 0) + result.score);
    }

    const rows = users.map((user) => {
        const seasonPoints = roundTwo(Math.max(pointsByUser.get(user.id) || 0, 0));
        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.id === currentUserId ? user.email : null,
            avatarUrl: user.avatarUrl,
            useInitials: user.useInitials,
            arenaScore: roundTwo(Math.max(user.arenaScore, 0)),
            seasonPoints,
            activeDays: activeDatesByUser.get(user.id)?.size || 0,
            rank: rankForPoints(seasonPoints),
            // Kept for API compatibility with the existing frontend. The main
            // leaderboard now represents universal season points, not a weekly
            // challenge result.
            competitionScore: seasonPoints,
            position: 0,
            isCurrentUser: user.id === currentUserId,
        } satisfies LeaderboardUser;
    });

    rows.sort((left, right) =>
        right.seasonPoints - left.seasonPoints ||
        right.arenaScore - left.arenaScore ||
        right.activeDays - left.activeDays ||
        left.username.localeCompare(right.username) ||
        left.id.localeCompare(right.id),
    );

    return rows.map((entry, index) => ({ ...entry, position: index + 1 }));
}

export const leaderboardService = {
    async getLeaderboard(userId: string, requestedLimit = 10): Promise<LeaderboardResponse> {
        const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 10, 1), 50);
        const results = await getOrderedResults(userId);
        const currentUser = results.find((entry) => entry.id === userId);
        if (!currentUser) throw new TrackingError("Leaderboard account was not found.", 404);

        return {
            totalDevelopers: results.length,
            currentUser,
            topPerformers: results.slice(0, limit),
        };
    },

    async getNearby(userId: string): Promise<LeaderboardNearbyResponse> {
        const results = await getOrderedResults(userId);
        const currentIndex = results.findIndex((entry) => entry.id === userId);
        if (currentIndex < 0) return { currentPosition: 0, entries: [] };

        const start = Math.max(0, Math.min(currentIndex - 1, Math.max(results.length - 3, 0)));
        return {
            currentPosition: currentIndex + 1,
            entries: results.slice(start, start + 3),
        };
    },

    async search(userId: string, rawQuery: unknown): Promise<LeaderboardSearchResponse> {
        const query = String(rawQuery || "").trim().toLowerCase();
        if (query.length < 2) {
            throw new TrackingError("Enter at least two characters to search developers.");
        }

        const results = await getOrderedResults(userId);
        const normalizedUsername = query.replace(/^@/, "");
        const searchResults = results
            .filter((entry) =>
                entry.name.toLowerCase().includes(query) ||
                entry.username.toLowerCase().includes(normalizedUsername) ||
                (entry.id === userId && entry.email?.toLowerCase().includes(query)),
            )
            .slice(0, 10);

        return { query, results: searchResults };
    },
};
