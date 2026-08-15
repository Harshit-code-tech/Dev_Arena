import type { Prisma } from "@prisma/client";

export type DashboardLogEntry = {
    id: string;
    text: string;
    createdAt: Date;
};

export type DashboardStats = {
    arenaScore: number;
    streak: number;
    activeDays: number;
    seasonPoints: number;
    seasonNumber: number;
    rank: string;
    seasonStartDate: Date;
    weeklyBonusClaimed: boolean;
    seasonBonusClaimed: boolean;
};

export type DashboardResponse = {
    stats: DashboardStats;
    logs: DashboardLogEntry[];
};

export type DashboardUpdateInput = {
    weeklyBonusClaimed?: boolean;
    seasonBonusClaimed?: boolean;
    resetSeason?: boolean;
};

export type DashboardUpdateData = Prisma.UserUpdateInput;

export type QuickLogInput = {
    activity: string;
};
