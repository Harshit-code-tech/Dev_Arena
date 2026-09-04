import type { User } from "@prisma/client";
import { dashboardRepository } from "./dashboard.repository";
import { prisma } from "../../database/prisma";
import { rebuildUserScoreState } from "../../shared/services/scoring.service";
import { getWeekStart, getWeekEnd } from "../../shared/utils/tracking";
import type {
    DashboardLogEntry,
    DashboardResponse,
    DashboardStats,
    DashboardUpdateData,
    DashboardUpdateInput,
} from "./dashboard.types";

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

        const stats: DashboardStats = {
            arenaScore: user.arenaScore,
            streak: user.streak,
            activeDays: user.activeDays,
            seasonPoints: user.seasonPoints,
            seasonNumber: user.seasonNumber,
            rank: user.rank,
            seasonStartDate: user.seasonStartDate,
            weeklyBonusClaimed: user.weeklyBonusClaimed,
            seasonBonusClaimed: user.seasonBonusClaimed,
            weeklyActiveDays,
            consistencyRating: consistencyRating(weeklyActiveDays),
        };

        return { stats, logs };
    },

    async updateDashboard(userId: string, input: DashboardUpdateInput): Promise<User> {
        if (input.resetSeason) {
            return prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        seasonStartDate: new Date(),
                        seasonNumber: { increment: 1 },
                        weeklyBonusClaimed: false,
                        seasonBonusClaimed: false,
                    },
                });
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

