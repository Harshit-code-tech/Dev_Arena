import { callAI, isAIAvailable } from "../../shared/utils/ai-client";
import { prisma } from "../../database/prisma";
import { getWeekStart, getWeekEnd } from "../../shared/utils/tracking";

// ── Types ────────────────────────────────────────────────────────

type CoachTone = "roast" | "motivational" | "strong";

interface CoachFeedback {
    message: string;
    tone: CoachTone;
    activeDays: number;
    aiGenerated: boolean;
}

// ── Static fallback pools ────────────────────────────────────────
// Kept as a safety net when no AI keys are configured or both providers fail.

const ROAST_MESSAGES = [
    "3 days or fewer? Even your keyboard is disappointed. It was really looking forward to being used.",
    "Your Arena score called. It's doing fine without you, but it misses you. Sort of.",
    "Low activity detected. Don't worry — the algorithms are very good at waiting. They've been practicing.",
    "At this pace, even the 'Unranked' badge is starting to feel like an achievement.",
    "The leaderboard updated this week. You were not exactly a major plot point.",
    "Three active days. Three! Your keyboard has more keys than that — use some of them.",
    "The Arena is still here. Your DSA problems are still unsolved. Your heatmap has opinions.",
    "The code isn't going to solve itself. Unfortunately, neither is your Arena score.",
    "Your weekly activity looks suspiciously like a weekend-only subscription.",
    "The leaderboard hasn't forgotten you. It just hasn't had much reason to mention you.",
    "Did you take an unscheduled sabbatical, or are you just admiring your VS Code wallpaper?",
    "Your git graph is looking like a desert. Not a single green cactus in sight.",
    "Zero bugs found this week! Mainly because you didn't write any code, genius.",
    "Bro, even your console.log is getting lonely. Open the editor.",
    "If excuses gave Arena points, you'd be ranked #1 globally right now.",
    "Procrastination is winning 3-0 against you. Stage a comeback already, bro.",
    "Are you coding or just staring intensely at Stack Overflow hoping for telepathy?",
    "Your streak is currently hanging on by a thread and a prayer. Fix it.",
];

const MOTIVATIONAL_MESSAGES = [
    "4+ active days? Okay, you're cooking. Don't burn the kitchen now.",
    "Look at you actually following through. Your rivals are quietly stressing.",
    "Solid week. The gap between you and the top 10 is shrinking. Keep stomping.",
    "Consistency detected. Reluctant respect granted from the AI Coach.",
    "You showed up when you could've binged Netflix. Respect. Keep stacking wins.",
    "4+ days in the Arena. That's not beginner's luck, that's dangerous momentum.",
    "Streak looking healthy, code compiling cleanly, score going up. Life is good.",
    "You're locking in. Keep this up and your future self owes you a coffee.",
    "Another week, another set of problems crushed. That's how we move the needle.",
    "Not bad at all. You're actually making this coding thing look like a habit.",
];

const STRONG_MESSAGES = [
    "6+ days active?! Are you running on caffeine, spite, or sheer willpower? You're a menace.",
    "Six days in the Arena this week. At this rate, the server might overheat from your commits.",
    "Touch grass? Absolutely not. You're dominating the leaderboard and nobody can stop you.",
    "6 active days. Even the AI Coach is taking notes from you at this point.",
    "Demon mode activated. Your friends don't stand a chance this season.",
    "Almost a clean 7/7 week. Finish strong — make them remember who runs this Arena.",
    "Unstoppable. The compiler fears you. The leaderboard respects you.",
    "You're not just participating in the Arena anymore — you're setting the pace.",
];

// ── Helpers ──────────────────────────────────────────────────────

function pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function toneFor(activeDays: number): CoachTone {
    if (activeDays <= 3) return "roast";
    if (activeDays <= 5) return "motivational";
    return "strong";
}

function toneInstruction(tone: CoachTone): string {
    switch (tone) {
        case "roast":
            return (
                "You are a witty, mischievous AI coach who ROASTS the player. " +
                "Be sarcastic, funny, and humiliating — but never genuinely mean or cruel. " +
                "Reference their actual lazy stats to make the burn sting. Troll them hard."
            );
        case "motivational":
            return (
                "You are an AI coach giving reluctant, backhanded encouragement. " +
                "Acknowledge their solid effort but keep the tone slightly snarky and competitive. " +
                "Make them feel good but also slightly scared of slipping."
            );
        case "strong":
            return (
                "You are an AI coach in awe of this player's insane grind. " +
                "Hype them up dramatically — they are carrying the entire leaderboard. " +
                "Be over the top. Express genuine terror at their dedication."
            );
    }
}

// ── Gemini prompt builder ────────────────────────────────────────

async function buildGeminiMessage(
    userId: string,
    activeDays: number,
    tone: CoachTone,
): Promise<string | null> {
    if (!isAIAvailable()) return null;

    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekEnd = getWeekEnd(now);

    const [user, weeklyScore, recentEvents, rivals] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, rank: true, arenaScore: true, streak: true },
        }),
        prisma.weeklyScore.findFirst({
            where: { userId, weekStart },
            select: {
                totalScore: true,
                dsaPoints: true,
                projectPoints: true,
                fullstackPoints: true,
                practicePoints: true,
            },
        }),
        prisma.scoreEvent.findMany({
            where: { userId, occurredAt: { gte: weekStart, lt: weekEnd } },
            orderBy: { occurredAt: "desc" },
            take: 5,
            select: { sourceType: true, points: true, label: true },
        }),
        prisma.weeklyScore.findMany({
            where: { weekStart, userId: { not: userId } },
            orderBy: { totalScore: "desc" },
            take: 3,
            select: {
                totalScore: true,
                user: { select: { name: true } },
            },
        }),
    ]);

    if (!user) return null;

    const totalScore = weeklyScore?.totalScore ?? 0;
    const dsaPoints = weeklyScore?.dsaPoints ?? 0;
    const projectPoints = weeklyScore?.projectPoints ?? 0;
    const fullstackPoints = weeklyScore?.fullstackPoints ?? 0;
    const practicePoints = weeklyScore?.practicePoints ?? 0;

    const recentActivity =
        recentEvents.length > 0
            ? recentEvents
                  .map((e) => `${e.sourceType}: ${e.label} (+${e.points}pts)`)
                  .join("; ")
            : "nothing logged yet this week";

    const rivalSummary =
        rivals.length > 0
            ? rivals
                  .map((r, i) => `#${i + 1} ${r.user?.name ?? "Unknown"}: ${r.totalScore}pts`)
                  .join(", ")
            : "no rivals yet this week";

    return (
        `${toneInstruction(tone)}\n\n` +
        `Player context:\n` +
        `- Name: ${user.name ?? "Coder"}\n` +
        `- Rank: ${user.rank}\n` +
        `- Arena Score (all-time): ${user.arenaScore}\n` +
        `- Current streak: ${user.streak} days\n` +
        `- Active days this week: ${activeDays}/7\n` +
        `- Weekly score — DSA: ${dsaPoints}pts | Projects: ${projectPoints}pts | Fullstack: ${fullstackPoints}pts | Practice: ${practicePoints}pts | Total: ${totalScore}pts\n` +
        `- Recent activity: ${recentActivity}\n` +
        `- Top rivals this week: ${rivalSummary}\n\n` +
        `Rules:\n` +
        `- Write EXACTLY ONE punchy, specific line (max 2 sentences, max 220 characters total).\n` +
        `- Reference their actual stats — make it feel personal.\n` +
        `- Be creative and mischievous. No generic coding advice. No hashtags.\n` +
        `- Output ONLY the message text. No quotes, no labels, no extra formatting.`
    );
}

// ── Response cache — reduces AI calls per user ────────────────────
// Coach feedback only changes meaningfully when activeDays changes (midnight)
// or the user makes significant activity. A 4-hour TTL per user is generous
// and still feels "live" while slashing AI usage by ~10×.

const COACH_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry {
    feedback: CoachFeedback;
    activeDays: number;   // invalidate if this changes
    expiresAt: number;
}

const coachCache = new Map<string, CacheEntry>();

// Purge expired entries every hour to avoid unbounded memory growth
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of coachCache.entries()) {
        if (entry.expiresAt <= now) coachCache.delete(key);
    }
}, 60 * 60 * 1000).unref();

// ── Service ──────────────────────────────────────────────────────

export const coachService = {
    async getFeedback(userId: string): Promise<CoachFeedback> {
        const now = new Date();
        const weekStart = getWeekStart(now);
        const weekEnd = getWeekEnd(now);

        const activeDays = await prisma.activity.count({
            where: {
                userId,
                date: { gte: weekStart, lt: weekEnd },
                isActive: true,
            },
        });

        // ── Cache hit — return without touching AI ────────────────
        const cached = coachCache.get(userId);
        if (
            cached &&
            cached.expiresAt > Date.now() &&
            cached.activeDays === activeDays  // invalidate if user became more active
        ) {
            return cached.feedback;
        }

        const tone = toneFor(activeDays);

        // ── Try AI (Gemini → Groq fallback with circuit-breaker) ─────
        if (isAIAvailable()) {
            try {
                const prompt = await buildGeminiMessage(userId, activeDays, tone);
                if (prompt) {
                    const text = await callAI(prompt, { maxTokens: 220, temperature: 0.92 });
                    if (text && text.length > 10) {
                        const feedback: CoachFeedback = { message: text, tone, activeDays, aiGenerated: true };
                        coachCache.set(userId, { feedback, activeDays, expiresAt: Date.now() + COACH_CACHE_TTL_MS });
                        return feedback;
                    }
                }
            } catch (err) {
                console.error(
                    "[coach] AI unavailable, falling back to static pool:",
                    err instanceof Error ? err.message : err,
                );
            }
        }

        // ── Fallback — static pool (cache this too to avoid repeated DB hits) ─
        const pool =
            tone === "roast"
                ? ROAST_MESSAGES
                : tone === "motivational"
                  ? MOTIVATIONAL_MESSAGES
                  : STRONG_MESSAGES;

        const feedback: CoachFeedback = { message: pickRandom(pool), tone, activeDays, aiGenerated: false };
        // Cache static fallback for only 30 min — retry AI sooner
        coachCache.set(userId, { feedback, activeDays, expiresAt: Date.now() + 30 * 60 * 1000 });
        return feedback;
    },
};