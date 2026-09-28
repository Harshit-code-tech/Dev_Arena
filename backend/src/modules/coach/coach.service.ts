import { callAI, isAIAvailable } from "../../shared/utils/ai-client";
import { prisma } from "../../database/prisma";
import { getWeekStart, getWeekEnd } from "../../shared/utils/tracking";

// ── Types ────────────────────────────────────────────────────────

type CoachTone = "focus" | "motivational" | "strong";

interface CoachFeedback {
    message: string;
    tone: CoachTone;
    activeDays: number;
    aiGenerated: boolean;
}

// ── Static fallback pools ────────────────────────────────────────
// Kept as a safety net when no AI keys are configured or both providers fail.

const FOCUS_MESSAGES = [
    "Momentum can restart with one focused session. Choose a problem or task you can complete today.",
    "A quieter week is a good point to reset. Pick one meaningful development goal and make visible progress on it.",
    "Consistency grows from small, repeatable sessions. Start with the next concrete task in front of you.",
    "Your activity is lighter this week. A short DSA session or project update is enough to move forward.",
    "Use today to rebuild momentum: solve one problem, complete one task, or document one meaningful learning step.",
    "Progress does not need to be dramatic. One deliberate coding session can put the week back on track.",
    "Your dashboard is ready for the next update. Choose a focused task and turn it into recorded progress.",
    "A consistent development habit starts with showing up. Make the next session small, specific, and achievable.",
];

const MOTIVATIONAL_MESSAGES = [
    "You are building a solid week. Keep the rhythm steady and protect time for the next focused session.",
    "Your consistency is moving in the right direction. Keep combining practice with meaningful project work.",
    "Good progress this week. Continue with the same deliberate pace and keep documenting what you complete.",
    "You have built useful momentum. One more focused day can make this a strong week of development.",
    "Your recent activity shows consistency. Keep prioritizing work that strengthens both skills and portfolio evidence.",
    "Steady practice is becoming a habit. Keep the next task specific and measurable.",
    "You are following through consistently. Maintain the pace without sacrificing quality or learning depth.",
    "The week is progressing well. Keep solving, building, and reflecting on what each session teaches you.",
];

const STRONG_MESSAGES = [
    "Excellent consistency this week. Keep the quality high and use the momentum to complete meaningful work.",
    "You are maintaining a strong development rhythm. Protect that consistency and keep the next goal deliberate.",
    "A highly active week is taking shape. Focus on depth as well as volume so the work continues to compound.",
    "Your consistency is setting a strong pace. Keep balancing problem solving, project work, and sustainable focus.",
    "You are close to a complete week of activity. Finish with one meaningful session rather than chasing volume alone.",
    "Strong week. Keep converting consistent effort into better code, clearer thinking, and stronger project evidence.",
    "Your activity level is excellent. Maintain the standard by choosing work that challenges and improves you.",
    "You are setting a consistent pace. Keep building deliberately and let the results accumulate over time.",
];

// ── Helpers ──────────────────────────────────────────────────────

function pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function toneFor(activeDays: number): CoachTone {
    if (activeDays <= 3) return "focus";
    if (activeDays <= 5) return "motivational";
    return "strong";
}

function toneInstruction(tone: CoachTone): string {
    switch (tone) {
        case "focus":
            return (
                "You are a supportive developer coach helping a player rebuild momentum. " +
                "Be calm, specific, and encouraging. Use their real activity data to suggest a practical next step without judgment."
            );
        case "motivational":
            return (
                "You are a developer coach reinforcing a solid week of consistent work. " +
                "Acknowledge progress, stay practical, and encourage the player to maintain a sustainable development rhythm."
            );
        case "strong":
            return (
                "You are a developer coach recognizing an excellent week of consistent activity. " +
                "Encourage the player to maintain quality, depth, and sustainable focus while continuing to improve."
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
        `- Be specific, constructive, and developer-focused. Avoid sarcasm, insults, hype, or generic advice. No hashtags.\n` +
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
            tone === "focus"
                ? FOCUS_MESSAGES
                : tone === "motivational"
                  ? MOTIVATIONAL_MESSAGES
                  : STRONG_MESSAGES;

        const feedback: CoachFeedback = { message: pickRandom(pool), tone, activeDays, aiGenerated: false };
        // Cache static fallback for only 30 min — retry AI sooner
        coachCache.set(userId, { feedback, activeDays, expiresAt: Date.now() + 30 * 60 * 1000 });
        return feedback;
    },
};