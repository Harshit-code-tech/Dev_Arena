import type { User } from "@prisma/client";
import { dashboardRepository } from "./dashboard.repository";
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
};

export const dashboardService: DashboardService = {
    async getDashboard(userId: string): Promise<DashboardResponse | null> {
        const user = await dashboardRepository.findUserWithLogs(userId);

        if (!user) {
            return null;
        }

        const logs: DashboardLogEntry[] = [
            ...user.dsaLogs.map((log) => ({
                id: log.id,
                text: `DSA: ${log.problemName}`,
                createdAt: log.createdAt,
            })),
            ...user.fullstackLogs.map((log) => ({
                id: log.id,
                text: `Fullstack: ${log.title}`,
                createdAt: log.createdAt,
            })),
            ...user.projectLogs.map((log) => ({
                id: log.id,
                text: `Project: ${log.description}`,
                createdAt: log.createdAt,
            })),
            ...user.practiceLogs.map((log) => ({
                id: log.id,
                text: `Practice: ${log.notes || "Completed"}`,
                createdAt: log.createdAt,
            })),
        ];

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

    updateDashboard(userId: string, input: DashboardUpdateInput): Promise<User> {
        const updateData: DashboardUpdateData = {};

        if (input.streak !== undefined) updateData.streak = input.streak;
        if (input.activeDays !== undefined) updateData.activeDays = input.activeDays;
        if (input.seasonPoints !== undefined) updateData.seasonPoints = input.seasonPoints;
        if (input.rank !== undefined) updateData.rank = input.rank;
        if (input.weeklyBonusClaimed !== undefined) updateData.weeklyBonusClaimed = input.weeklyBonusClaimed;
        if (input.seasonBonusClaimed !== undefined) updateData.seasonBonusClaimed = input.seasonBonusClaimed;
        if (input.seasonNumber !== undefined) updateData.seasonNumber = input.seasonNumber;
        if (input.arenaScore !== undefined) updateData.arenaScore = input.arenaScore;

        if (input.resetSeason) {
            updateData.seasonStartDate = new Date();
        }

        return dashboardRepository.updateUserDashboard(userId, updateData);
    },
};
