import type { Prisma } from "@prisma/client";
import { getWeekStart, getWeekEnd } from "../utils/tracking";

const ACHIEVEMENT_MESSAGES: Record<string, string> = {
    "Baby Steps": "Achievement unlocked: Baby Steps! 👶 10 DSA problems solved. Look at you crawling before sprinting into Google.",
    "Half Century": "Achievement unlocked: Half Century! 🏏 50 DSA problems down. Your brain is officially 30% dynamic programming.",
    "First Chapter": "Achievement unlocked: First Chapter! 📖 First fullstack log created. You actually touched real code today, we're proud.",
    "Learning Machine": "Achievement unlocked: Learning Machine! 🤖 5 fullstack logs deep. Tutorial hell has officially lost a victim.",
    "Builder Mode: ON": "Achievement unlocked: Builder Mode: ON! 🔨 First project created. Now please actually finish it.",
    "Checkpoint Reached": "Achievement unlocked: Checkpoint Reached! ⛳ First milestone crushed. One brick down, castle pending.",
    "Ship It!": "Achievement unlocked: Ship It! 🚀 You completed a whole project! Does it have unit tests? Don't answer that.",
    "Showing Up": "Achievement unlocked: Showing Up! ⚡ 3 active days this week. You beat the Sunday-night guilt.",
    "Lock In": "Achievement unlocked: Lock In! 🔥 5 active days this week. Absolute monster work ethic. Drink some water.",
};

/**
 * Checks all seeded achievement conditions for a user and creates
 * UserAchievement + Notification records for any newly met conditions.
 *
 * Called at the end of rebuildUserScoreState so it always runs inside
 * the same transaction with accurate, freshly-written data.
 *
 * Achievements use @@unique([userId, achievementId]) so concurrent calls
 * and retries are safe — duplicate inserts are silently ignored.
 */
export async function checkAndUnlock(
    tx: Prisma.TransactionClient,
    userId: string,
): Promise<void> {
    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);

    // ── Gather all counts in parallel ────────────────────────────────────────
    const [
        dsaCount,
        fullstackCount,
        projectsCreated,
        milestonesCompleted,
        projectsCompleted,
        activeDaysThisWeek,
        allAchievements,
        alreadyUnlocked,
    ] = await Promise.all([
        tx.dSALog.count({ where: { userId } }),
        tx.fullstackLog.count({ where: { userId } }),
        tx.project.count({ where: { userId } }),
        tx.milestone.count({
            where: { project: { userId }, status: "Completed" },
        }),
        tx.project.count({ where: { userId, status: "Completed" } }),
        tx.activity.count({
            where: { userId, date: { gte: weekStart, lt: weekEnd }, isActive: true },
        }),
        tx.achievement.findMany(),
        tx.userAchievement.findMany({
            where: { userId },
            select: { achievementId: true },
        }),
    ]);

    const unlockedIds = new Set(alreadyUnlocked.map((ua) => ua.achievementId));

    const metricFor = (conditionType: string, conditionValue: number): number => {
        switch (conditionType) {
            case "dsa_problems_solved":       return dsaCount;
            case "fullstack_logs_count":      return fullstackCount;
            case "projects_created":          return projectsCreated;
            case "milestones_completed":      return milestonesCompleted;
            case "projects_completed":        return projectsCompleted;
            case "active_days_in_week":       return activeDaysThisWeek;
            default:
                console.warn(`[achievement] Unknown condition type: ${conditionType} (threshold ${conditionValue})`);
                return -1;
        }
    };

    // ── Evaluate each achievement ─────────────────────────────────────────────
    const toUnlock = allAchievements.filter((a) => {
        if (unlockedIds.has(a.id)) return false;
        const metric = metricFor(a.conditionType, a.conditionValue);
        return metric >= a.conditionValue;
    });

    if (toUnlock.length === 0) return;

    // ── Create UserAchievement records (ignore duplicate conflicts) ───────────
    for (const achievement of toUnlock) {
        try {
            await tx.userAchievement.create({
                data: { userId, achievementId: achievement.id },
            });

            const unlockMessage = ACHIEVEMENT_MESSAGES[achievement.title]
                ?? `Achievement unlocked: ${achievement.title}! 🏆 Go flex this on your rivals immediately.`;

            await tx.notification.create({
                data: {
                    userId,
                    type: "system",
                    message: unlockMessage,
                    link: "/profile",
                    entityType: "achievement",
                    entityId: achievement.id,
                },
            });
        } catch (error: unknown) {
            // P2002 = unique constraint — already unlocked by a concurrent call. Safe to skip.
            const code = (error as { code?: string }).code;
            if (code !== "P2002") throw error;
        }
    }
}
