/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DevArena — Unified AI Client
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Strategy
 * ────────
 *  1. Try PRIMARY provider (Gemini Flash 2.0 by default).
 *  2. If PRIMARY is rate-limited or errors → immediately try SECONDARY (Groq).
 *  3. If SECONDARY is also unavailable → return null.
 *  4. Callers always handle null with a curated static fallback.
 *
 * Rate-limit circuit breaker
 * ──────────────────────────
 *  • A 429 from any provider marks it "cooling down" for RATE_LIMIT_COOLDOWN_MS.
 *  • During cooldown all calls skip that provider instantly (no wasted latency).
 *  • Cooldown resets automatically — no restart required.
 *
 * Static fallbacks
 * ────────────────
 *  Every feature (coach, hint, roast, generator) has its own static pool.
 *  When callAI() returns null, the calling service picks from the pool.
 *  This means zero AI dependency for core functionality.
 *
 * No AI keys configured?
 * ──────────────────────
 *  Both GEMINI_API_KEY and GROQ_API_KEY are optional.
 *  If neither is set, callAI() returns null immediately and the static
 *  fallback always wins — the platform works fully without any AI keys.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AIProvider = "gemini" | "groq";

export interface AICallOptions {
    /** Max tokens to generate. Default 256. */
    maxTokens?: number;
    /** Temperature 0–1. Default 0.85. */
    temperature?: number;
    /**
     * Preferred provider order. If omitted, defaults to ["gemini", "groq"].
     * Pass ["groq", "gemini"] to prefer Groq for a specific call (e.g. fast tasks).
     */
    preferredOrder?: AIProvider[];
}

// ── Circuit-breaker state (module-level, resets on server restart) ─────────────

const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;      // 429: hard rate limit — 5 min
const TRANSIENT_COOLDOWN_MS  = 90 * 1000;           // 503: soft transient — 90 sec + jitter

const rateLimitedUntil: Record<AIProvider, number> = {
    gemini: 0,
    groq: 0,
};

function isOnCooldown(provider: AIProvider): boolean {
    return Date.now() < rateLimitedUntil[provider];
}

function markRateLimited(provider: AIProvider): void {
    rateLimitedUntil[provider] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    console.warn(
        `[ai-client] ${provider} 429 rate-limited — cooling down for ${RATE_LIMIT_COOLDOWN_MS / 60000} min. ` +
        `Next eligible: ${new Date(rateLimitedUntil[provider]).toISOString()}`,
    );
}

/** 503/502/504: put provider on a short cooldown with random jitter to prevent thundering-herd */
function markTransient(provider: AIProvider): void {
    const jitter = Math.floor(Math.random() * 15_000); // 0–15 s random jitter
    rateLimitedUntil[provider] = Date.now() + TRANSIENT_COOLDOWN_MS + jitter;
    console.warn(
        `[ai-client] ${provider} transient overload — backing off for ${((TRANSIENT_COOLDOWN_MS + jitter) / 1000).toFixed(0)} s.`,
    );
}

// ── Provider implementations ──────────────────────────────────────────────────

/**
 * Calls Google Gemini Flash Latest via REST.
 * Using raw fetch (not the SDK) so we can inspect the HTTP status code
 * and detect 429s before they throw.
 * Configurable via GEMINI_MODEL env var (defaults to gemini-flash-latest).
 */
async function callGemini(prompt: string, opts: AICallOptions): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || isOnCooldown("gemini")) return null;

    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: opts.maxTokens ?? 256,
                    temperature: opts.temperature ?? 0.85,
                },
            }),
            signal: AbortSignal.timeout(15_000),
        });
    } catch (err) {
        console.error("[ai-client] Gemini network error:", err instanceof Error ? err.message : err);
        return null;
    }

    if (response.status === 429) {
        markRateLimited("gemini");
        return null;
    }

    // 503/502/504 are transient — put provider on short cooldown then try next provider.
    // Only treat 4xx (non-429) as definitive failures.
    if (!response.ok) {
        const isTransient = response.status >= 500;
        if (isTransient) {
            markTransient("gemini");
        } else {
            console.error(`[ai-client] Gemini HTTP ${response.status} — non-retryable (client error).`);
        }
        return null;
    }

    try {
        type GeminiResponse = {
            candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
            }>;
        };
        const data = (await response.json()) as GeminiResponse;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return text && text.length > 5 ? text : null;
    } catch {
        console.error("[ai-client] Gemini JSON parse failed.");
        return null;
    }
}

/**
 * Calls Groq via its OpenAI-compatible chat completions API.
 * Model: openai/gpt-oss-20b (GPT OSS 20B) — recommended Groq replacement model.
 * Can be overridden via GROQ_MODEL environment variable.
 */
async function callGroq(prompt: string, opts: AICallOptions): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || isOnCooldown("groq")) return null;

    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    let response: Response;
    try {
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                max_tokens: opts.maxTokens ?? 256,
                temperature: opts.temperature ?? 0.85,
            }),
            signal: AbortSignal.timeout(15_000),
        });
    } catch (err) {
        console.error("[ai-client] Groq network error:", err instanceof Error ? err.message : err);
        return null;
    }

    if (response.status === 429) {
        markRateLimited("groq");
        return null;
    }

    // 503/502/504 are transient — put provider on short cooldown then try next provider.
    if (!response.ok) {
        const isTransient = response.status >= 500;
        if (isTransient) {
            markTransient("groq");
        } else {
            console.error(`[ai-client] Groq HTTP ${response.status} — non-retryable (client error).`);
        }
        return null;
    }

    try {
        type GroqResponse = {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const data = (await response.json()) as GroqResponse;
        const text = data?.choices?.[0]?.message?.content?.trim();
        return text && text.length > 5 ? text : null;
    } catch {
        console.error("[ai-client] Groq JSON parse failed.");
        return null;
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

const PROVIDER_FNS: Record<AIProvider, (prompt: string, opts: AICallOptions) => Promise<string | null>> = {
    gemini: callGemini,
    groq: callGroq,
};

/**
 * Calls AI providers in order, returning the first successful response.
 * Returns null when all configured providers are unavailable or on cooldown —
 * the caller is then responsible for using a static fallback.
 *
 * @example
 * const text = await callAI(prompt);
 * const message = text ?? pickRandom(STATIC_FALLBACK_POOL);
 */
export async function callAI(prompt: string, opts: AICallOptions = {}): Promise<string | null> {
    const order: AIProvider[] = opts.preferredOrder ?? ["gemini", "groq"];

    for (const provider of order) {
        const fn = PROVIDER_FNS[provider];
        if (!fn) continue;

        const result = await fn(prompt, opts);
        if (result) {
            return result;
        }
    }

    console.warn("[ai-client] All AI providers returned null — caller should use static fallback.");
    return null;
}

/**
 * Returns true if at least one AI provider is configured and not on cooldown.
 * Use this to skip expensive prompt-building when AI is unavailable.
 */
export function isAIAvailable(): boolean {
    return (!!process.env.GEMINI_API_KEY && !isOnCooldown("gemini")) ||
        (!!process.env.GROQ_API_KEY && !isOnCooldown("groq"));
}

/**
 * Returns a status snapshot for the /health or /api/admin/system-health route.
 */
export function aiClientStatus(): Record<string, unknown> {
    const now = Date.now();
    return {
        gemini: {
            configured: !!process.env.GEMINI_API_KEY,
            onCooldown: isOnCooldown("gemini"),
            cooldownExpiresAt: rateLimitedUntil.gemini > now
                ? new Date(rateLimitedUntil.gemini).toISOString()
                : null,
        },
        groq: {
            configured: !!process.env.GROQ_API_KEY,
            onCooldown: isOnCooldown("groq"),
            cooldownExpiresAt: rateLimitedUntil.groq > now
                ? new Date(rateLimitedUntil.groq).toISOString()
                : null,
        },
    };
}
