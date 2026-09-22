import { sendDevArenaEmail } from "../../shared/utils/email";

function supportError(message: string, status = 400) {
    return Object.assign(new Error(message), { statusCode: status });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const supportService = {
    async submitMessage(input: Record<string, unknown>) {
        const name = String(input.name || "").trim();
        const email = String(input.email || "").trim();
        const message = String(input.message || "").trim();

        if (name.length < 2) throw supportError("Name must be at least 2 characters. Even 'Al' or 'Ed' works!");
        if (name.length > 100) throw supportError("Whoa, that name is longer than a Java class name. Keep it under 100 characters.");
        if (!EMAIL_PATTERN.test(email)) throw supportError("Give us a real email so we don't send replies into the void.");
        if (message.length < 10) throw supportError("Message too short! Give us at least 10 characters to explain what broke.");
        if (message.length > 1000) throw supportError("Whoa, essay writer! Keep it under 1000 characters.");

        const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);

        if (adminEmails.length === 0) {
            console.warn("[support] ADMIN_EMAILS is not configured — support message not delivered.");
            return { delivered: false };
        }

        for (const adminEmail of adminEmails) {
            await sendDevArenaEmail(adminEmail, `DevArena support message from ${name}`, {
                eyebrow: "DevArena Support",
                title: "New support message",
                paragraphs: [
                    `From: ${name} <${email}>`,
                    message,
                ],
                footer: "This message was submitted via the DevArena support page.",
            });
        }

        return { delivered: true };
    },
};
