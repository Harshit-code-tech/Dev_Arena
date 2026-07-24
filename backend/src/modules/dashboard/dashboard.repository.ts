import type { Prisma, User, PracticeLog } from "@prisma/client";
import { prisma } from "../../database/prisma";
import type { DashboardUpdateData } from "./dashboard.types";

const dashboardUserInclude = {
    dsaLogs: {
        select: { id: true, problemName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    },
    fullstackLogs: {
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    },
    projectLogs: {
        select: { id: true, description: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    },
    practiceLogs: {
        select: { id: true, notes: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    },
} satisfies Prisma.UserInclude;

type DashboardUserWithLogs = Prisma.UserGetPayload<{
    include: typeof dashboardUserInclude;
}>;

type DashboardRepository = {
    findUserWithLogs(userId: string): Promise<DashboardUserWithLogs | null>;
    updateUserDashboard(userId: string, data: DashboardUpdateData): Promise<User>;
    createQuickLog(userId: string, text: string, scoreIncrement: number): Promise<{ log: PracticeLog; user: User }>;
};

export const dashboardRepository: DashboardRepository = {
    findUserWithLogs(userId: string): Promise<DashboardUserWithLogs | null> {
        return prisma.user.findUnique({
            where: { id: userId },
            include: dashboardUserInclude,
        });
    },

    updateUserDashboard(userId: string, data: DashboardUpdateData): Promise<User> {
        return prisma.user.update({
            where: { id: userId },
            data,
        });
    },

    async createQuickLog(userId: string, text: string, scoreIncrement: number) {
        return prisma.$transaction(async (tx) => {
            const log = await tx.practiceLog.create({
                data: {
                    userId,
                    type: "DSA_Revision",
                    notes: text,
                },
            });

            const user = await tx.user.update({
                where: { id: userId },
                data: { arenaScore: { increment: scoreIncrement } },
            });

            return { log, user };
        });
    },
};
