import { prisma } from "../../database/prisma";
import { getWeekStart } from "../utils/tracking";

const INACTIVITY_HOURS = 72;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;

const INACTIVITY_ROASTS = [
    "🚨 72 hours of zero code. Did your keyboard break, or did you rage quit?",
    "🪦 Your streak is in the ICU. 3 days without activity. Revive it before it flatlines!",
    "👀 Hello? Anyone home? The leaderboard is moving without you, bro.",
    "👻 3 days MIA. Even your ghost commits have given up. Time to get back in the Arena!",
    "📉 Your Arena rank is bleeding points while your rivals celebrate. Wake up and code!",
];

function pickInactivityRoast(): string {
    return INACTIVITY_ROASTS[Math.floor(Math.random() * INACTIVITY_ROASTS.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Inactivity Reminder Worker
// Runs every 6 hours. Finds users with no ScoreEvent in the last 72 hours
// and no inactivity notification already sent in the same window.
// ─────────────────────────────────────────────────────────────────────────────
async function runInactivityCheck() {
    try {
        const cutoff = new Date(Date.now() - INACTIVITY_HOURS * 60 * 60 * 1000);

        // Users whose last score event is older than 72 hours (or who have no events)
        const inactiveUsers = await prisma.user.findMany({
            where: {
                inAppNotifications: true,
                scoreEvents: {
                    none: { occurredAt: { gte: cutoff } },
                },
            },
            select: { id: true },
        });

        if (inactiveUsers.length === 0) return;

        // Filter out users who already received an inactivity reminder in this window
        const alreadyNotified = await prisma.notification.findMany({
            where: {
                userId: { in: inactiveUsers.map((u) => u.id) },
                entityType: "inactivity_reminder",
                createdAt: { gte: cutoff },
            },
            select: { userId: true },
        });

        const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));
        const toNotify = inactiveUsers.filter((u) => !notifiedIds.has(u.id));

        if (toNotify.length === 0) return;

        await prisma.notification.createMany({
            data: toNotify.map((u) => ({
                userId: u.id,
                type: "reminder" as const,
                message: pickInactivityRoast(),
                link: "/dashboard",
                entityType: "inactivity_reminder",
                entityId: u.id,
            })),
        });

        console.log(`[inactivity-worker] Sent reminders to ${toNotify.length} user(s).`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[inactivity-worker] Failed:", message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Summary Worker
// Runs every 30 minutes but only fires on Sunday between 20:00–23:59 UTC.
// Creates one summary notification per user per week.
// ─────────────────────────────────────────────────────────────────────────────
async function runWeeklySummaryCheck() {
    try {
        const now = new Date();
        const isSunday = now.getUTCDay() === 0;
        const hour = now.getUTCHours();
        if (!isSunday || hour < 20) return;

        const weekStart = getWeekStart(now);

        // Users who haven't received a weekly summary for the current week yet
        const allUsers = await prisma.user.findMany({
            where: { inAppNotifications: true },
            select: { id: true },
        });

        if (allUsers.length === 0) return;

        const alreadySent = await prisma.notification.findMany({
            where: {
                userId: { in: allUsers.map((u) => u.id) },
                entityType: "weekly_summary",
                createdAt: { gte: weekStart },
            },
            select: { userId: true },
        });

        const sentIds = new Set(alreadySent.map((n) => n.userId));
        const toNotify = allUsers.filter((u) => !sentIds.has(u.id));

        if (toNotify.length === 0) return;

        // Fetch weekly scores for these users
        const weeklyScores = await prisma.weeklyScore.findMany({
            where: {
                userId: { in: toNotify.map((u) => u.id) },
                weekStart,
            },
            select: { userId: true, totalScore: true, activeDays: true },
        });

        const scoreMap = new Map(weeklyScores.map((ws) => [ws.userId, ws]));

        await prisma.notification.createMany({
            data: toNotify.map((u) => {
                const ws = scoreMap.get(u.id);
                const points = ws?.totalScore ?? 0;
                const days = ws?.activeDays ?? 0;

                let summaryMessage: string;
                if (points === 0) {
                    summaryMessage = "Zero points this week. Absolutely criminal. Monday is reset day — wake up and choose violence.";
                } else if (days >= 6) {
                    summaryMessage = `Weekly recap: ${points} pts across ${days} active days. Absolute menace! You're making your rivals sweat. 🔥`;
                } else if (days >= 4) {
                    summaryMessage = `Weekly recap: ${points} pts across ${days} active days. Solid grind. Keep this momentum into next week! ⚡`;
                } else {
                    summaryMessage = `Weekly recap: ${points} pts across ${days} active ${days === 1 ? "day" : "days"}. Squeaked by this week. Monday is your redemption arc.`;
                }

                return {
                    userId: u.id,
                    type: "summary" as const,
                    message: summaryMessage,
                    link: "/dashboard",
                    entityType: "weekly_summary",
                    entityId: weekStart.toISOString().slice(0, 10),
                };
            }),
        });

        console.log(`[weekly-summary-worker] Sent summaries to ${toNotify.length} user(s).`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[weekly-summary-worker] Failed:", message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported starters — call these once inside server.ts .listen() callback
// ─────────────────────────────────────────────────────────────────────────────
export function startInactivityWorker() {
    const timer = setInterval(() => {
        void runInactivityCheck();
    }, SIX_HOURS_MS);
    timer.unref();
    console.log("[inactivity-worker] Started (runs every 6 hours).");
}

export function startWeeklySummaryWorker() {
    const timer = setInterval(() => {
        void runWeeklySummaryCheck();
    }, THIRTY_MIN_MS);
    timer.unref();
    console.log("[weekly-summary-worker] Started (checks every 30 min, fires Sunday 20:00–23:59 UTC).");
}

// ─────────────────────────────────────────────────────────────────────────────
// Rank Decay Worker
// Runs once daily. Users with zero ScoreEvents in the last 14 days lose 5%
// of their seasonPoints per run (floor 1pt) until they become active again.
// Implements scoringupdate.md §8.
// ─────────────────────────────────────────────────────────────────────────────

const DECAY_RATE = 0.05;             // 5% of seasonPoints per missed fortnight
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function runRankDecay() {
    try {
        const cutoff = new Date(Date.now() - TWO_WEEKS_MS);

        // Users who have earned season points but logged nothing in 2 weeks
        const inactiveUsers = await prisma.user.findMany({
            where: {
                seasonPoints: { gt: 0 },
                scoreEvents: {
                    none: { occurredAt: { gte: cutoff } },
                },
            },
            select: { id: true, seasonPoints: true },
        });

        if (inactiveUsers.length === 0) return;

        let decayedCount = 0;
        for (const user of inactiveUsers) {
            const decayAmount = Math.max(1, Math.floor(user.seasonPoints * DECAY_RATE));
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    seasonPoints: { decrement: decayAmount },
                },
            });
            decayedCount++;
        }

        console.log(`[rank-decay-worker] Applied ${(DECAY_RATE * 100).toFixed(0)}% decay to ${decayedCount} inactive user(s).`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[rank-decay-worker] Failed:", message);
    }
}

export function startRankDecayWorker() {
    // Run once immediately on startup to catch any already-stale users
    void runRankDecay();
    const timer = setInterval(() => {
        void runRankDecay();
    }, TWENTY_FOUR_HOURS_MS);
    timer.unref();
    console.log("[rank-decay-worker] Started (runs every 24 hours).");
}

// ─────────────────────────────────────────────────────────────────────────────
// Challenge Deadline Reminder Worker  (Phase 1.4)
// Runs every 30 min. Fires when an Active competition has < 24h remaining.
// Each user gets at most one notification per competition per week.
// ─────────────────────────────────────────────────────────────────────────────
async function runChallengeDeadlineReminder() {
    try {
        const now = new Date();
        const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const closingSoon = await prisma.weeklyCompetition.findMany({
            where: {
                status: "Active",
                closesAt: { lte: in24h, gte: now },
            },
            select: { id: true, title: true, closesAt: true },
        });

        if (closingSoon.length === 0) return;

        const users = await prisma.user.findMany({
            where: { inAppNotifications: true },
            select: { id: true },
        });
        if (users.length === 0) return;

        for (const comp of closingSoon) {
            const alreadyNotified = await prisma.notification.findMany({
                where: {
                    entityType: "challenge_deadline",
                    entityId: comp.id,
                    createdAt: { gte: getWeekStart(now) },
                },
                select: { userId: true },
            });
            const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));
            const toNotify = users.filter((u) => !notifiedIds.has(u.id));
            if (toNotify.length === 0) continue;

            const hoursLeft = Math.ceil((comp.closesAt!.getTime() - Date.now()) / (60 * 60 * 1000));

            await prisma.notification.createMany({
                data: toNotify.map((u) => ({
                    userId: u.id,
                    type: "challenge" as const,
                    message: `⏰ "${comp.title}" closes in ${hoursLeft}h! Submit your solution or watch the W slip away.`,
                    link: "/challenges",
                    entityType: "challenge_deadline",
                    entityId: comp.id,
                })),
            });

            console.log(`[challenge-deadline-worker] Sent ${toNotify.length} reminder(s) for "${comp.title}" (${hoursLeft}h left).`);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[challenge-deadline-worker] Failed:", message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tournament Live Reminder Worker  (Phase 1.4)
// Runs every 30 min. Fires when a tournament transitions to Live state
// (startsAt is within the last 30 min). Notifies all registered participants.
// ─────────────────────────────────────────────────────────────────────────────
async function runTournamentLiveReminder() {
    try {
        const now = new Date();
        const cutoff = new Date(Date.now() - THIRTY_MIN_MS);

        const liveTournaments = await prisma.tournament.findMany({
            where: {
                status: "Live",
                startsAt: { gte: cutoff, lte: now },
            },
            select: { id: true, title: true },
        });

        if (liveTournaments.length === 0) return;

        for (const t of liveTournaments) {
            const registrations = await prisma.tournamentRegistration.findMany({
                where: {
                    tournamentId: t.id,
                    status: { notIn: ["Withdrawn", "Disqualified"] },
                    user: { inAppNotifications: true },
                },
                select: { userId: true },
            });
            if (registrations.length === 0) continue;

            const alreadyNotified = await prisma.notification.findMany({
                where: { entityType: "tournament_live", entityId: t.id },
                select: { userId: true },
            });
            const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));
            const toNotify = registrations.filter((r) => !notifiedIds.has(r.userId));
            if (toNotify.length === 0) continue;

            await prisma.notification.createMany({
                data: toNotify.map((r) => ({
                    userId: r.userId,
                    type: "challenge" as const,
                    message: `🚀 "${t.title}" is now LIVE! Open the arena, submit your solution, and claim your place on the board.`,
                    link: "/tournaments",
                    entityType: "tournament_live",
                    entityId: t.id,
                })),
            });

            console.log(`[tournament-live-worker] Sent ${toNotify.length} live notification(s) for "${t.title}".`);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[tournament-live-worker] Failed:", message);
    }
}

export function startChallengeDeadlineWorker() {
    void runChallengeDeadlineReminder();
    const timer = setInterval(() => {
        void runChallengeDeadlineReminder();
    }, THIRTY_MIN_MS);
    timer.unref();
    console.log("[challenge-deadline-worker] Started (checks every 30 min).");
}

export function startTournamentLiveWorker() {
    void runTournamentLiveReminder();
    const timer = setInterval(() => {
        void runTournamentLiveReminder();
    }, THIRTY_MIN_MS);
    timer.unref();
    console.log("[tournament-live-worker] Started (checks every 30 min).");
}

