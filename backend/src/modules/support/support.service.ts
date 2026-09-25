import { prisma } from "../../database/prisma";
import { sendDevArenaEmail } from "../../shared/utils/email";

function supportError(message: string, status = 400) {
    return Object.assign(new Error(message), { statusCode: status });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Disposable / temp email domain blocklist ──────────────────────────────────
// Common throwaway email providers that are used for spam.
const DISPOSABLE_DOMAINS = new Set([
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info", "guerrillamailblock.com",
    "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.co.uk",
    "tempmail.com", "temp-mail.org", "temp-mail.io", "throwam.com", "throwam.net",
    "trashmail.com", "trashmail.net", "trashmail.me", "trashmail.at", "trashmail.io",
    "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc",
    "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf",
    "monemail.fr.nf", "monmail.fr.nf", "spam4.me", "fakeinbox.com", "mailnull.com",
    "spamgourmet.com", "ccinbox.com", "dispostable.com", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "spam.la", "mailnesia.com",
    "mailnull.com", "maildrop.cc", "mailsac.com", "discard.email",
    "spamgourmet.org", "spamgourmet.net", "notmailinator.com",
]);

function isDisposableEmail(email: string): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    return DISPOSABLE_DOMAINS.has(domain);
}

// ── Per-email in-memory rate limiting ────────────────────────────────────────
// Max 3 messages from the same email address per 6 hours, regardless of IP.
// This complements the per-IP route-level limit (5/hr via express-rate-limit).

const RATE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_PER_EMAIL = 3;

const emailSubmitLog = new Map<string, number[]>(); // email → [timestamps]

function checkEmailRateLimit(email: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;
    const history = (emailSubmitLog.get(email) ?? []).filter((t) => t > windowStart);
    if (history.length >= MAX_PER_EMAIL) return false;
    emailSubmitLog.set(email, [...history, now]);
    return true;
}

// Purge stale entries every hour to prevent memory leaks on long-running server.
setInterval(() => {
    const windowStart = Date.now() - RATE_WINDOW_MS;
    for (const [email, timestamps] of emailSubmitLog.entries()) {
        const fresh = timestamps.filter((t) => t > windowStart);
        if (fresh.length === 0) {
            emailSubmitLog.delete(email);
        } else {
            emailSubmitLog.set(email, fresh);
        }
    }
}, 60 * 60 * 1000).unref();

export const supportService = {
    async submitMessage(input: Record<string, unknown>) {
        const name = String(input.name || "").trim();
        const email = String(input.email || "").trim().toLowerCase();
        const subject = String(input.subject || "").trim();
        const message = String(input.message || "").trim();

        // ── Input validation ──────────────────────────────────────────────
        if (name.length < 2) throw supportError("Name must be at least 2 characters. Even 'Al' or 'Ed' works!");
        if (name.length > 100) throw supportError("Whoa, that name is longer than a Java class name. Keep it under 100 characters.");
        if (!EMAIL_PATTERN.test(email)) throw supportError("Give us a real email so we don't send replies into the void.");
        if (subject.length < 3) throw supportError("Add a subject (at least 3 characters) so we know what you're asking about.");
        if (subject.length > 150) throw supportError("Subject too long — keep it under 150 characters.");
        if (message.length < 10) throw supportError("Message too short! Give us at least 10 characters to explain what broke.");
        if (message.length > 1000) throw supportError("Whoa, essay writer! Keep it under 1000 characters.");

        // ── Spam & disposable email checks ───────────────────────────────
        if (isDisposableEmail(email)) {
            throw supportError("Disposable / temporary email addresses are not accepted. Use a real email so we can reply.");
        }

        if (!checkEmailRateLimit(email)) {
            throw supportError(
                `You've sent ${MAX_PER_EMAIL} messages in the last 6 hours from this email address. Give us a chance to respond!`,
                429,
            );
        }

        // ── Step 1: Always persist to DB first — message is never lost ──
        const record = await prisma.supportMessage.create({
            data: { name, email, message: `[${subject}] ${message}`, delivered: false },
        });

        // ── Step 2: Attempt email delivery ───────────────────────────────
        const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);

        if (adminEmails.length === 0) {
            console.warn("[support] ADMIN_EMAILS not configured — message stored in DB (id: " + record.id + "), no email sent.");
            return { delivered: false };
        }

        let delivered = false;
        try {
            const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
            for (const adminEmail of adminEmails) {
                await sendDevArenaEmail(adminEmail, `[DevArena Support] ${subject}`, {
                    eyebrow: "DevArena Support Request",
                    title: subject || "New support message",
                    paragraphs: [
                        `From: ${name}`,
                        `Email: ${email}`,
                        `Submitted: ${now} IST`,
                        `───────────────────────────────`,
                        message,
                    ],
                    action: { label: `Reply to ${name}`, url: `mailto:${email}?subject=Re: ${encodeURIComponent(subject)}` },
                    footer: `Submitted via DevArena contact form. Reply directly to this email to respond to ${name} at ${email}.`,
                }, email); // pass replyTo as 4th arg (see below)
            }
            delivered = true;
        } catch (err) {
            // SMTP failure is non-fatal — the message is already in the DB.
            console.error("[support] Email delivery failed for id " + record.id + ":", err instanceof Error ? err.message : err);
        }

        // ── Step 3: Update delivery status ───────────────────────────────
        await prisma.supportMessage.update({
            where: { id: record.id },
            data: { delivered },
        });

        return { delivered };
    },
};

