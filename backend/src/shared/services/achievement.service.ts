import type { Prisma } from "@prisma/client";
import { getWeekStart, getWeekEnd } from "../utils/tracking";

const ACHIEVEMENT_MESSAGES: Record<string, string> = {
    "Baby Steps": "Achievement unlocked: Baby Steps! You have solved 10 DSA problems and established a strong foundation for continued practice.",
    "Half Century": "Achievement unlocked: Half Century! You have solved 50 DSA problems. Keep strengthening pattern recognition and problem-solving depth.",
    "First Chapter": "Achievement unlocked: First Chapter! Your first fullstack learning or implementation entry is now recorded.",
    "Learning Machine": "Achievement unlocked: Learning Machine! Five fullstack entries show consistent progress from learning into implementation.",
    "Builder Mode: ON": "Achievement unlocked: Builder Mode: ON! Your first project is now tracked. Keep moving it forward through clear milestones and work sessions.",
    "Checkpoint Reached": "Achievement unlocked: Checkpoint Reached! You completed your first project milestone and created measurable project progress.",
    "Ship It!": "Achievement unlocked: Ship It! You completed a tracked project. Review the outcome, document what you learned, and carry it into the next build.",
    "Showing Up": "Achievement unlocked: Showing Up! You recorded meaningful development activity on three days this week.",
    "Lock In": "Achievement unlocked: Lock In! Five active days this week reflect strong development consistency.",
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
                ?? `Achievement unlocked: ${achievement.title}! Keep building on this progress.`;

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
