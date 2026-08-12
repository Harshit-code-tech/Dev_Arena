import { ScoreCategory, type User } from "@prisma/client";
import { randomUUID } from "crypto";
import { dashboardRepository } from "./dashboard.repository";
import { prisma } from "../../database/prisma";
import { rebuildUserScoreState, upsertScoreEvent } from "../../shared/services/scoring.service";
import { requiredText } from "../../shared/utils/tracking";
import type {
    DashboardLogEntry,
    DashboardResponse,
    DashboardStats,
    DashboardUpdateData,
    DashboardUpdateInput,
} from "./dashboard.types";

type DashboardService = {
    getDashboard(userId: string): Promise<DashboardResponse | null>;
    updateDashboard(userId: string, input: DashboardUpdateInput): Promise<User>;
    createQuickLog(userId: string, activity: unknown): Promise<{ id: string; text: string; points: number; createdAt: Date }>;
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
    async createQuickLog(userId: string, activity: unknown) {
        const text = requiredText(activity, "Activity", 10);
        const id = randomUUID();
        const occurredAt = new Date();

        return prisma.$transaction(async (tx) => {
            await upsertScoreEvent(tx, {
                userId,
                category: ScoreCategory.General,
                sourceType: "QUICK_LOG",
                sourceId: id,
                label: `Quick Log: ${text}`,
                points: 5,
                occurredAt,
            });
            await rebuildUserScoreState(tx, userId);
            return { id, text, points: 5, createdAt: occurredAt };
        });
    },

};
