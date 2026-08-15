import { FullstackCategory, FullstackType, ScoreCategory } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { rebuildUserScoreState, removeScoreEvent, upsertScoreEvent } from "../../shared/services/scoring.service";
import {
    ensureEditable,
    getWeekEnd,
    getWeekStart,
    optionalUrl,
    parseActivityDate,
    positiveInteger,
    requiredText,
    TrackingError,
} from "../../shared/utils/tracking";
import { FULLSTACK_POINTS, type FullstackLogInput } from "./fullstack.types";

function parseCategory(value: unknown): FullstackCategory {
    if (value === FullstackCategory.Course_Progress || value === FullstackCategory.Practical_Work) {
        return value;
    }
    throw new TrackingError("Fullstack category must be course progress or practical work.");
}

function parseType(value: unknown): FullstackType {
    if (value === FullstackType.Learning || value === FullstackType.Building) {
        return value;
    }
    throw new TrackingError("Fullstack activity type must be Learning or Building.");
}

function parseInput(input: Partial<FullstackLogInput>, existingActivityDate?: Date) {
    const category = parseCategory(input.category);
    const type = category === FullstackCategory.Course_Progress
        ? FullstackType.Learning
        : parseType(input.type);

    return {
        title: requiredText(
            input.title,
            category === FullstackCategory.Course_Progress ? "Section or part" : "Task title",
            4,
        ),
        category,
        type,
        description: requiredText(
            input.description,
            category === FullstackCategory.Course_Progress ? "Key concepts learned" : "Task description",
            10,
        ),
        timeSpent: positiveInteger(input.timeSpent, "Time spent", 960),
        proofLink: optionalUrl(input.proofLink),
        activityDate: input.activityDate ? parseActivityDate(input.activityDate) : existingActivityDate || parseActivityDate(undefined),
    };
}

export const fullstackService = {
    async getLogs(userId: string) {
        const now = new Date();
        const [logs, weeklyLogs] = await Promise.all([
            prisma.fullstackLog.findMany({
                where: { userId },
                orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
            }),
            prisma.fullstackLog.findMany({
                where: { userId, activityDate: { gte: getWeekStart(now), lt: getWeekEnd(now) } },
                select: { category: true, type: true },
            }),
        ]);

        return {
            logs: logs.map((log) => ({ ...log, points: FULLSTACK_POINTS[log.type] })),
            summary: {
                weeklyActivities: weeklyLogs.length,
                weeklyPoints: weeklyLogs.reduce((sum, log) => sum + FULLSTACK_POINTS[log.type], 0),
                courseProgress: weeklyLogs.filter((log) => log.category === FullstackCategory.Course_Progress).length,
                practicalTasks: weeklyLogs.filter((log) => log.category === FullstackCategory.Practical_Work).length,
                learning: weeklyLogs.filter((log) => log.type === FullstackType.Learning).length,
                building: weeklyLogs.filter((log) => log.type === FullstackType.Building).length,
                targetSections: "2–4",
                targetTasks: "3–5",
            },
        };
    },

    async createLog(userId: string, input: Partial<FullstackLogInput>) {
        const data = parseInput(input);
        const duplicate = await prisma.fullstackLog.findFirst({
            where: {
                userId,
                activityDate: data.activityDate,
                title: { equals: data.title, mode: "insensitive" },
            },
        });
        if (duplicate) throw new TrackingError("This fullstack activity is already logged for that date.", 409);

        return prisma.$transaction(async (tx) => {
            const log = await tx.fullstackLog.create({ data: { userId, ...data } });
            await upsertScoreEvent(tx, {
                userId,
                category: ScoreCategory.Fullstack,
                sourceType: "FULLSTACK_LOG",
                sourceId: log.id,
                label: `${log.category === FullstackCategory.Course_Progress ? "Course progress" : log.type}: ${log.title}`,
                points: FULLSTACK_POINTS[log.type],
                occurredAt: log.activityDate,
            });
            await rebuildUserScoreState(tx, userId);
            return { ...log, points: FULLSTACK_POINTS[log.type] };
        });
    },

    async updateLog(userId: string, id: string, input: Partial<FullstackLogInput>) {
        const existing = await prisma.fullstackLog.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("Fullstack entry not found.", 404);
        ensureEditable(existing.createdAt);
        const data = parseInput(input, existing.activityDate);
        const duplicate = await prisma.fullstackLog.findFirst({
            where: {
                userId,
                id: { not: id },
                activityDate: data.activityDate,
                title: { equals: data.title, mode: "insensitive" },
            },
        });
        if (duplicate) throw new TrackingError("This fullstack activity is already logged for that date.", 409);

        return prisma.$transaction(async (tx) => {
            const log = await tx.fullstackLog.update({ where: { id }, data });
            await upsertScoreEvent(tx, {
                userId,
                category: ScoreCategory.Fullstack,
                sourceType: "FULLSTACK_LOG",
                sourceId: log.id,
                label: `${log.category === FullstackCategory.Course_Progress ? "Course progress" : log.type}: ${log.title}`,
                points: FULLSTACK_POINTS[log.type],
                occurredAt: log.activityDate,
            });
            await rebuildUserScoreState(tx, userId);
            return { ...log, points: FULLSTACK_POINTS[log.type] };
        });
    },

    async deleteLog(userId: string, id: string) {
        const existing = await prisma.fullstackLog.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("Fullstack entry not found.", 404);
        ensureEditable(existing.createdAt);

        return prisma.$transaction(async (tx) => {
            await tx.fullstackLog.delete({ where: { id } });
            await removeScoreEvent(tx, userId, "FULLSTACK_LOG", id);
            await rebuildUserScoreState(tx, userId);
        });
    },
};
