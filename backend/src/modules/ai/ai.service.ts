import { prisma } from "../../database/prisma";
import { getWeekStart, TrackingError } from "../../shared/utils/tracking";
import { callAI, isAIAvailable } from "../../shared/utils/ai-client";
import type { RivalRoastResponse, GeneratedTask, GenerateChallengeInput } from "./ai.types";

// ── Phase 4.2 — Rival Roast ───────────────────────────────────────────────────
// Static fallback pool — used when both AI providers are unavailable.

const RIVAL_ROAST_FALLBACKS = [
    "A developer moved ahead of you in the weekly standings. Review the gap and focus on the next meaningful activity.",
    "Your leaderboard position changed this week. Consistent verified work is the clearest path to moving back up.",
    "The standings have shifted. Use the comparison as a signal for your next focused practice or project session.",
    "A nearby developer has moved ahead. Keep your attention on steady progress rather than a single ranking change.",
    "Your position moved down in the latest update. Continue building points through useful, repeatable development work.",
];

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Rival roast cache — throttle AI calls per user+rival pair ─────────────────
// Key: `${userId}:${rivalId}`, TTL: 30 min.
// Multiple leaderboard refreshes / rank-drop events should not re-call AI
// for the same combination that was already roasted recently.
const roastCache = new Map<string, { response: RivalRoastResponse; expiresAt: number }>();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of roastCache.entries()) { if (v.expiresAt <= now) roastCache.delete(k); }
}, 15 * 60 * 1000).unref();

export const aiService = {
    async generateRivalRoast(userId: string, rivalId: string): Promise<RivalRoastResponse> {
        // ── Cache check (30-min TTL per user+rival pair) ─────────────
        const cacheKey = `${userId}:${rivalId}`;
        const cached = roastCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.response;
        }

        const weekStart = getWeekStart(new Date());

        const [user, rival, userWeekly, rivalWeekly] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, rank: true, arenaScore: true },
            }),
            prisma.user.findUnique({
                where: { id: rivalId },
                select: { name: true, rank: true, arenaScore: true },
            }),
            prisma.weeklyScore.findFirst({
                where: { userId, weekStart },
                select: { totalScore: true },
            }),
            prisma.weeklyScore.findFirst({
                where: { userId: rivalId, weekStart },
                select: { totalScore: true },
            }),
        ]);

        const yourScore = userWeekly?.totalScore ?? 0;
        const rivalScore = rivalWeekly?.totalScore ?? 0;
        const rivalName = rival?.name ?? "Someone";

        // Static fallback path — no AI keys configured or both on cooldown
        if (!isAIAvailable()) {
            const response: RivalRoastResponse = {
                message: pickRandom(RIVAL_ROAST_FALLBACKS),
                rivalName,
                yourScore,
                rivalScore,
            };
            // Cache fallback for 30 min too — same pair shouldn't re-query DB repeatedly
            roastCache.set(cacheKey, { response, expiresAt: Date.now() + 30 * 60 * 1000 });
            return response;
        }

        const prompt =
            `You are a concise, constructive developer-performance coach for a platform called DevArena.\n\n` +
            `${rivalName} (rank #${rival?.rank ?? "?"}, ${rivalScore} pts this week) ` +
            `just OVERTOOK ${user?.name ?? "the player"} (rank #${user?.rank ?? "?"}, ${yourScore} pts this week) ` +
            `on the weekly leaderboard.\n\n` +
            `Write a single constructive performance note (1–2 sentences, under 180 characters) ` +
            `for the developer whose position just changed. ` +
            `Reference the rank movement and the other developer's name when useful. Be calm, specific, and encouraging. No sarcasm or insults. No hashtags. ` +
            `Output ONLY the message text.`;

        const text = await callAI(prompt, {
            maxTokens: 120,
            temperature: 0.95,
            // Groq is slightly snappier for short punchy text — prefer it when available
            preferredOrder: ["groq", "gemini"],
        });

        const response: RivalRoastResponse = {
            message: text ?? pickRandom(RIVAL_ROAST_FALLBACKS),
            rivalName,
            yourScore,
            rivalScore,
        };
        roastCache.set(cacheKey, { response, expiresAt: Date.now() + 30 * 60 * 1000 });
        return response;
    },


    // ── Phase 4.3 — AI Challenge Generator ──────────────────────────────────
    // Admin enters a topic, AI returns a structured challenge ready to review.

    async generateChallengeTask(input: GenerateChallengeInput): Promise<GeneratedTask> {
        const { topic, difficulty = "Medium" } = input;

        if (!isAIAvailable()) {
            throw new TrackingError(
                "No AI providers are currently available — both GEMINI_API_KEY and GROQ_API_KEY are missing or on cooldown. " +
                "Add at least one key to .env and try again.",
                503,
            );
        }

        const prompt =
            `You are a competitive programming problem setter for a platform called DevArena.\n\n` +
            `Generate a ${difficulty}-difficulty coding challenge about: "${topic}"\n\n` +
            `Return ONLY valid JSON (no markdown fences, no explanation) with this exact shape:\n` +
            `{\n` +
            `  "title": "string (concise, max 60 chars)",\n` +
            `  "description": "string (2–4 paragraphs, plain text, no code blocks — problem statement, input/output format, constraints)",\n` +
            `  "difficulty": "${difficulty}",\n` +
            `  "expectedTime": "string e.g. O(n log n)",\n` +
            `  "expectedSpace": "string e.g. O(n)",\n` +
            `  "sampleTestCases": [\n` +
            `    { "input": "string", "expectedOutput": "string" },\n` +
            `    { "input": "string", "expectedOutput": "string" }\n` +
            `  ]\n` +
            `}\n\n` +
            `Make it original, specific, and solvable. All sample test cases must be correct.`;

        const rawText = await callAI(prompt, {
            maxTokens: 1024,
            temperature: 0.75,
            // Prefer Gemini for structured JSON — it follows format instructions more reliably
            preferredOrder: ["gemini", "groq"],
        });

        if (!rawText) {
            throw new TrackingError(
                "AI is temporarily unavailable (both Gemini and Groq returned no response). " +
                "This is usually a transient overload — wait 30 seconds and try again.",
                503,
            );
        }

        // Strip any accidental markdown fences
        const cleaned = rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();

        let parsed: GeneratedTask;
        try {
            parsed = JSON.parse(cleaned) as GeneratedTask;
        } catch {
            throw new TrackingError("AI returned malformed JSON — try rephrasing the topic or try again.", 422);
        }

        if (!parsed.title || !parsed.description || !Array.isArray(parsed.sampleTestCases)) {
            throw new TrackingError("AI response is missing required fields — try again.", 422);
        }

        return parsed;
    },
};
