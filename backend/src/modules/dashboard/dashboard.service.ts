import type { User } from "@prisma/client";
import { dashboardRepository } from "./dashboard.repository";
import { prisma } from "../../database/prisma";
import { rebuildUserScoreState } from "../../shared/services/scoring.service";
import { formatDateKey, getWeekStart, getWeekEnd } from "../../shared/utils/tracking";
import { getCurrentSeasonWindow } from "../../shared/config/season";
import { PROJECT_SCORE_VERSION, rebuildProjectScoresForUser } from "../projects/project-scoring";
import type {
    DashboardLogEntry,
    DashboardResponse,
    DashboardStats,
    DashboardUpdateData,
    DashboardUpdateInput,
} from "./dashboard.types";


const RANKS = [
    { name: "Unranked", points: 0 }, { name: "Mud", points: 100 }, { name: "Wood", points: 175 },
    { name: "Stone", points: 250 }, { name: "Iron", points: 350 }, { name: "Silver", points: 475 },
    { name: "Gold", points: 625 }, { name: "Platinum", points: 800 }, { name: "Ruby", points: 1000 },
    { name: "Diamond", points: 1250 }, { name: "Developer", points: 1500 },
] as const;

function roundTwo(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rankForPoints(points: number) {
    let rank: string = RANKS[0].name;
    for (const candidate of RANKS) if (points >= candidate.points) rank = candidate.name;
    return rank;
}

// 14 — Consistency classification
function consistencyRating(weeklyActiveDays: number): "Low" | "Moderate" | "Consistent" {
    if (weeklyActiveDays >= 5) return "Consistent";
    if (weeklyActiveDays >= 3) return "Moderate";
    return "Low";
}

type DashboardService = {
    getDashboard(userId: string): Promise<DashboardResponse | null>;
    updateDashboard(userId: string, input: DashboardUpdateInput): Promise<User>;
};

export const dashboardService: DashboardService = {
    async getDashboard(userId: string): Promise<DashboardResponse | null> {
        // One-time rebuild when project score semantics change (for example,
        // stabilizing repository evidence on the original project date). This
        // makes the heatmap correct even if the user visits Dashboard before Projects.
        const staleProjectScores = await prisma.project.count({
            where: {
                userId,
                OR: [
                    { projectScoreVersion: null },
                    { projectScoreVersion: { not: PROJECT_SCORE_VERSION } },
                ],
            },
        });
        if (staleProjectScores > 0) {
            await prisma.$transaction((tx) => rebuildProjectScoresForUser(tx, userId));
        }

        const user = await dashboardRepository.findUserWithLogs(userId);

        if (!user) {
            return null;
        }

        const logs: DashboardLogEntry[] = user.scoreEvents.map((event) => ({
            id: event.id,
            text: event.label,
            createdAt: event.occurredAt,
        }));

        logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Count distinct active days in the current week for consistency rating
        const now = new Date();
        const weeklyActiveDays = await prisma.activity.count({
            where: {
                userId,
                date: { gte: getWeekStart(now), lt: getWeekEnd(now) },
                isActive: true,
            },
        });

        const season = getCurrentSeasonWindow(now);
        const challengeResults = await prisma.challengeResult.findMany({
            where: {
                userId,
                weekStart: { gte: season.start, lt: season.end },
            },
            select: { score: true },
        });
        const seasonEvents = user.scoreEvents.filter((event) =>
            event.occurredAt >= season.start && event.occurredAt < season.end
        );
        const seasonPoints = roundTwo(
            seasonEvents.reduce((sum, event) => sum + event.points, 0) +
            challengeResults.reduce((sum, result) => sum + result.score, 0),
        );
        const seasonActiveDays = new Set(seasonEvents.map((event) => formatDateKey(event.occurredAt))).size;

        const stats: DashboardStats = {
            arenaScore: user.arenaScore,
            streak: user.streak,
            activeDays: seasonActiveDays,
            seasonPoints,
            seasonNumber: season.seasonNumber,
            rank: rankForPoints(seasonPoints),
            seasonStartDate: season.start,
            weeklyBonusClaimed: user.weeklyBonusClaimed,
            seasonBonusClaimed: user.seasonBonusClaimed,
            weeklyActiveDays,
            consistencyRating: consistencyRating(weeklyActiveDays),
        };

        return { stats, logs };
    },

    async updateDashboard(userId: string, input: DashboardUpdateInput): Promise<User> {
        if (input.resetSeason) {
            // Seasons are universal 60-day windows now. Older clients may still
            // send resetSeason when their countdown reaches zero, but a single
            // user must never move the shared season boundary. Rebuild only.
            return prisma.$transaction(async (tx) => {
                await rebuildUserScoreState(tx, userId);
                return tx.user.findUniqueOrThrow({ where: { id: userId } });
            });
        }

        const updateData: DashboardUpdateData = {};
        if (input.weeklyBonusClaimed !== undefined) updateData.weeklyBonusClaimed = input.weeklyBonusClaimed;
        if (input.seasonBonusClaimed !== undefined) updateData.seasonBonusClaimed = input.seasonBonusClaimed;

        if (Object.keys(updateData).length === 0) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) throw new Error("User not found");
            return user;
        }

        return dashboardRepository.updateUserDashboard(userId, updateData);
    },
};

