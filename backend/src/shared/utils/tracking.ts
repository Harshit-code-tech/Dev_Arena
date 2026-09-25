export class TrackingError extends Error {
    constructor(
        message: string,
        public readonly statusCode = 400,
    ) {
        super(message);
        this.name = "TrackingError";
    }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function requiredText(value: unknown, label: string, minimum = 2) {
    const text = typeof value === "string" ? value.trim() : "";

    if (text.length < minimum) {
        throw new TrackingError(`${label} needs at least ${minimum} characters. Give us something real to work with!`);
    }

    return text;
}

export function optionalText(value: unknown) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
}

export function positiveInteger(value: unknown, label: string, maximum = 1440) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0 || number > maximum) {
        throw new TrackingError(`${label} must be a whole number between 1 and ${maximum}. Did you code for 0 minutes or break physics?`);
    }

    return number;
}

export function optionalUrl(value: unknown, label = "Proof link") {
    const text = optionalText(value);
    if (!text) return null;

    try {
        const url = new URL(text);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("Unsupported protocol");
        }
        return url.toString();
    } catch {
        throw new TrackingError(`${label} must be a valid http or https URL. That link doesn't look real, bro.`);
    }
}

export function requiredUrl(value: unknown, label: string) {
    const url = optionalUrl(value, label);
    if (!url) throw new TrackingError(`${label} is required. Don't be shy, drop the link!`);
    return url;
}

export function parseActivityDate(value: unknown, allowBackdate = true) {
    const now = new Date();
    const rawValue = typeof value === "string" ? value.trim() : "";

    // Logging forms no longer ask users to select a date. New evidence therefore
    // receives the exact server timestamp, just like Quick Log, instead of the
    // previous fixed 12:00 UTC placeholder.
    const candidate = rawValue
        ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T12:00:00.000Z` : rawValue)
        : now;

    if (Number.isNaN(candidate.getTime())) {
        throw new TrackingError("Invalid activity date. What calendar are you using?");
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (candidate.getTime() > endOfToday.getTime()) {
        throw new TrackingError("Are you a time traveler? Activity date cannot be in the future.");
    }

    if (allowBackdate && candidate.getTime() < getWeekStart(now).getTime()) {
        throw new TrackingError("Nice try living in the past! Backdated entries are only allowed within the current week.");
    }

    return candidate;
}

export function ensureEditable(createdAt: Date) {
    if (Date.now() - createdAt.getTime() > DAY_MS) {
        throw new TrackingError("Too late! This entry is locked after 24 hours. History cannot be rewritten.", 403);
    }
}

export function getWeekStart(date: Date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const day = start.getUTCDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - distanceToMonday);
    return start;
}

export function getWeekEnd(date: Date) {
    return new Date(getWeekStart(date).getTime() + 7 * DAY_MS);
}

export function formatDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

export function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function sendTrackingError(error: unknown) {
    if (error instanceof TrackingError) {
        return { status: error.statusCode, message: error.message };
    }

    if (error instanceof Error) {
        // Support plain errors that have statusCode set on them
        const statusCode = (error as Error & { statusCode?: number }).statusCode;
        if (typeof statusCode === "number" && statusCode >= 100 && statusCode < 600) {
            return { status: statusCode, message: error.message };
        }
        return { status: 500, message: error.message };
    }

    return { status: 500, message: "Unexpected error" };
}
