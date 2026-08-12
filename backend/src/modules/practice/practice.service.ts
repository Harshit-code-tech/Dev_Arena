import { PracticeType, ScoreCategory } from "@prisma/client";
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
import { PRACTICE_POINTS, type PracticeLogInput } from "./practice.types";

function parseType(value: unknown): PracticeType {
    if (value === PracticeType.DSA_Revision || value === PracticeType.Concept_Explanation) {
        return value;
    }
    throw new TrackingError("Practice type must be revision or concept explanation.");
}

function parseInput(input: Partial<PracticeLogInput>, existingActivityDate?: Date) {
    return {
        title: requiredText(input.title, "Activity title", 4),
        type: parseType(input.type),
        notes: requiredText(input.notes, "Structured notes", 10),
        timeSpent: positiveInteger(input.timeSpent, "Time spent", 720),
        proofLink: optionalUrl(input.proofLink),
        activityDate: input.activityDate ? parseActivityDate(input.activityDate) : existingActivityDate || parseActivityDate(undefined),
    };
}

export const practiceService = {
    async getLogs(userId: string) {
        const now = new Date();
        const [logs, weeklyLogs] = await Promise.all([
            prisma.practiceLog.findMany({
                where: { userId },
                orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
            }),
            prisma.practiceLog.findMany({
                where: { userId, activityDate: { gte: getWeekStart(now), lt: getWeekEnd(now) } },
                select: { type: true },
            }),
        ]);

        return {
            logs: logs.map((log) => ({ ...log, points: PRACTICE_POINTS[log.type] })),
            summary: {
                weeklyActivities: weeklyLogs.length,
                weeklyPoints: weeklyLogs.reduce((sum, log) => sum + PRACTICE_POINTS[log.type], 0),
                revisions: weeklyLogs.filter((log) => log.type === PracticeType.DSA_Revision).length,
                learningSessions: weeklyLogs.filter((log) => log.type === PracticeType.Concept_Explanation).length,
            },
        };
    },

    async createLog(userId: string, input: Partial<PracticeLogInput>) {
        const data = parseInput(input);
        const duplicate = await prisma.practiceLog.findFirst({
            where: {
                userId,
                type: data.type,
                activityDate: data.activityDate,
                title: { equals: data.title, mode: "insensitive" },
            },
        });
        if (duplicate) throw new TrackingError("This practice activity is already logged for that date.", 409);

        return prisma.$transaction(async (tx) => {
            const log = await tx.practiceLog.create({ data: { userId, ...data } });
            await upsertScoreEvent(tx, {
                userId,
                category: ScoreCategory.Practice,
                sourceType: "PRACTICE_LOG",
                sourceId: log.id,
                label: `${log.type === "DSA_Revision" ? "Revision" : "Learning"}: ${log.title}`,
                points: PRACTICE_POINTS[log.type],
                occurredAt: log.activityDate,
            });
            await rebuildUserScoreState(tx, userId);
            return { ...log, points: PRACTICE_POINTS[log.type] };
        });
    },

    async updateLog(userId: string, id: string, input: Partial<PracticeLogInput>) {
        const existing = await prisma.practiceLog.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("Practice entry not found.", 404);
        ensureEditable(existing.createdAt);
        const data = parseInput(input, existing.activityDate);
        const duplicate = await prisma.practiceLog.findFirst({
            where: {
                userId,
                id: { not: id },
                type: data.type,
                activityDate: data.activityDate,
                title: { equals: data.title, mode: "insensitive" },
            },
        });
        if (duplicate) throw new TrackingError("This practice activity is already logged for that date.", 409);

        return prisma.$transaction(async (tx) => {
            const log = await tx.practiceLog.update({ where: { id }, data });
            await upsertScoreEvent(tx, {
                userId,
                category: ScoreCategory.Practice,
                sourceType: "PRACTICE_LOG",
                sourceId: log.id,
                label: `${log.type === "DSA_Revision" ? "Revision" : "Learning"}: ${log.title}`,
                points: PRACTICE_POINTS[log.type],
                occurredAt: log.activityDate,
            });
            await rebuildUserScoreState(tx, userId);
            return { ...log, points: PRACTICE_POINTS[log.type] };
        });
    },

    async deleteLog(userId: string, id: string) {
        const existing = await prisma.practiceLog.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("Practice entry not found.", 404);
        ensureEditable(existing.createdAt);

        return prisma.$transaction(async (tx) => {
            await tx.practiceLog.delete({ where: { id } });
            await removeScoreEvent(tx, userId, "PRACTICE_LOG", id);
            await rebuildUserScoreState(tx, userId);
        });
    },
};
