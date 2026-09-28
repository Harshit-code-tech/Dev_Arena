const DAY_MS = 24 * 60 * 60 * 1000;

export const DEVARENA_SEASON_LENGTH_DAYS = 60;

// Set DEVARENA_SEASON_START_DATE to the real public launch/deployment date.
// This fallback keeps local development deterministic and can be overridden
// without changing source code.
const DEFAULT_SEASON_START_DATE = "2026-09-27T00:00:00+05:30";

function getSeasonEpoch() {
    const raw = process.env.DEVARENA_SEASON_START_DATE?.trim() || DEFAULT_SEASON_START_DATE;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        console.warn(`[season] Invalid DEVARENA_SEASON_START_DATE=${raw}; using ${DEFAULT_SEASON_START_DATE}.`);
        return new Date(DEFAULT_SEASON_START_DATE);
    }
    return parsed;
}

export function getCurrentSeasonWindow(now = new Date()) {
    const epoch = getSeasonEpoch();
    const durationMs = DEVARENA_SEASON_LENGTH_DAYS * DAY_MS;
    const elapsedMs = now.getTime() - epoch.getTime();
    const completedSeasons = elapsedMs <= 0 ? 0 : Math.floor(elapsedMs / durationMs);
    const start = new Date(epoch.getTime() + completedSeasons * durationMs);
    const end = new Date(start.getTime() + durationMs);

    return {
        seasonNumber: completedSeasons + 1,
        start,
        end,
        lengthDays: DEVARENA_SEASON_LENGTH_DAYS,
    };
}
