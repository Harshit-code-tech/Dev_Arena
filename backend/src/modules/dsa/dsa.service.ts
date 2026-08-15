import { Difficulty } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { rebuildUserScoreState } from "../../shared/services/scoring.service";
import {
    ensureEditable,
    getWeekEnd,
    getWeekStart,
    optionalText,
    optionalUrl,
    parseActivityDate,
    positiveInteger,
    requiredText,
    requiredUrl,
    TrackingError,
} from "../../shared/utils/tracking";
import type { DsaLogInput } from "./dsa.types";
import { calculateDsaPoints, rebuildDsaScoreEvents } from "./dsa-scoring";

function parseDifficulty(value: unknown): Difficulty {
    if (value === Difficulty.Easy || value === Difficulty.Medium || value === Difficulty.Hard) {
        return value;
    }
    throw new TrackingError("Difficulty must be Easy, Medium, or Hard.");
}

function parseInput(input: Partial<DsaLogInput>, existingActivityDate?: Date) {
    return {
        problemName: requiredText(input.problemName, "Problem name", 3),
        url: requiredUrl(input.problemUrl, "Problem URL"),
        solutionUrl: optionalUrl(input.solutionUrl, "Solution or code URL"),
        difficulty: parseDifficulty(input.difficulty),
        timeTaken: positiveInteger(input.timeTaken, "Time taken", 720),
        timeComplexity: optionalText(input.timeComplexity),
        spaceComplexity: optionalText(input.spaceComplexity),
        notes: optionalText(input.notes),
        activityDate: input.activityDate ? parseActivityDate(input.activityDate) : existingActivityDate || parseActivityDate(undefined),
    };
}

export const dsaService = {
    async getLogs(userId: string) {
        const now = new Date();
        const [logs, weeklyLogs] = await Promise.all([
            prisma.dSALog.findMany({
                where: { userId },
                orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
            }),
            prisma.dSALog.findMany({
                where: {
                    userId,
                    activityDate: { gte: getWeekStart(now), lt: getWeekEnd(now) },
                },
                select: { id: true, difficulty: true },
            }),
        ]);

        const pointsById = calculateDsaPoints(logs);
        const weeklyIds = new Set(weeklyLogs.map((log) => log.id));
        const weeklyPoints = logs.reduce((sum, log) => sum + (weeklyIds.has(log.id) ? pointsById.get(log.id) || 0 : 0), 0);
        const breakdown = weeklyLogs.reduce(
            (result, log) => ({ ...result, [log.difficulty]: result[log.difficulty] + 1 }),
            { Easy: 0, Medium: 0, Hard: 0 },
        );

        return {
            logs: logs.map((log) => ({ ...log, points: pointsById.get(log.id) || 0 })),
            summary: {
                weeklySolved: weeklyLogs.length,
                weeklyPoints,
                targetMinimum: 8,
                targetMaximum: 12,
                breakdown,
            },
        };
    },

    async createLog(userId: string, input: Partial<DsaLogInput>) {
        const data = parseInput(input);
        const duplicate = await prisma.dSALog.findFirst({
            where: {
                userId,
                OR: [
                    { url: data.url },
                    { problemName: { equals: data.problemName, mode: "insensitive" } },
                ],
            },
        });

        if (duplicate) {
            throw new TrackingError("This problem has already been logged.", 409);
        }

        return prisma.$transaction(async (tx) => {
            const log = await tx.dSALog.create({ data: { userId, ...data } });
            const pointsById = await rebuildDsaScoreEvents(tx, userId);
            await rebuildUserScoreState(tx, userId);
            return { ...log, points: pointsById.get(log.id) || 0 };
        });
    },

    async updateLog(userId: string, id: string, input: Partial<DsaLogInput>) {
        const existing = await prisma.dSALog.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("DSA entry not found.", 404);
        ensureEditable(existing.createdAt);

        const data = parseInput(input, existing.activityDate);
        const duplicate = await prisma.dSALog.findFirst({
            where: {
                userId,
                id: { not: id },
                OR: [
                    { url: data.url },
                    { problemName: { equals: data.problemName, mode: "insensitive" } },
                ],
            },
        });
        if (duplicate) throw new TrackingError("This problem has already been logged.", 409);

        return prisma.$transaction(async (tx) => {
            const log = await tx.dSALog.update({ where: { id }, data });
            const pointsById = await rebuildDsaScoreEvents(tx, userId);
            await rebuildUserScoreState(tx, userId);
            return { ...log, points: pointsById.get(log.id) || 0 };
        });
    },

    async deleteLog(userId: string, id: string) {
        const existing = await prisma.dSALog.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("DSA entry not found.", 404);
        ensureEditable(existing.createdAt);

        return prisma.$transaction(async (tx) => {
            await tx.dSALog.delete({ where: { id } });
            await rebuildDsaScoreEvents(tx, userId);
            await rebuildUserScoreState(tx, userId);
            return { id };
        });
    },
};
