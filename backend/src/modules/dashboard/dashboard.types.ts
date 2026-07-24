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
    streak?: number;
    activeDays?: number;
    seasonPoints?: number;
    rank?: string;
    weeklyBonusClaimed?: boolean;
    seasonBonusClaimed?: boolean;
    seasonNumber?: number;
    arenaScore?: number;
    resetSeason?: boolean;
};

export type DashboardUpdateData = Prisma.UserUpdateInput;

export type QuickLogInput = {
    text: string;
};

export type QuickLogResponse = {
    log: DashboardLogEntry;
    arenaScore: number;
};

export type ProfileResponse = {
    stats: {
        arenaScore: number;
        streak: number;
        rank: string;
    };
    logs: DashboardLogEntry[];
    createdAt: Date;
};
