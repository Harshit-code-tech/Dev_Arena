import { prisma } from "../../database/prisma";
import { TrackingError, getWeekStart } from "../../shared/utils/tracking";
import type {
    LeaderboardNearbyResponse,
    LeaderboardResponse,
    LeaderboardSearchResponse,
    LeaderboardUser,
} from "./leaderboard.types";

// ── Private select/query helpers ─────────────────────────────────

const userSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    avatarUrl: true,
    useInitials: true,
    arenaScore: true,
    seasonPoints: true,
    activeDays: true,
    rank: true,
} as const;

function getOrderedResults() {
    return prisma.challengeResult.findMany({
        where: { weekStart: getWeekStart(new Date()) },
        select: {
            score: true,
            correctness: true,
            problemsSolved: true,
            efficiency: true,
            completionTime: true,
            user: { select: userSelect },
        },
        orderBy: [
            { score: "desc" },
            { correctness: "desc" },
            { problemsSolved: "desc" },
            { efficiency: "desc" },
            { completionTime: "asc" },
            { id: "asc" },
        ],
    });
}

type CompetitionEntry = Awaited<ReturnType<typeof getOrderedResults>>[number];

// ── Mappers ──────────────────────────────────────────────────────

function toLeaderboardUser(
    result: CompetitionEntry,
    position: number,
    currentUserId: string,
): LeaderboardUser {
    const user = result.user;
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.id === currentUserId ? user.email : null,
        avatarUrl: user.avatarUrl,
        useInitials: user.useInitials,
        arenaScore: user.arenaScore,
        seasonPoints: user.seasonPoints,
        activeDays: user.activeDays,
        rank: user.rank,
        competitionScore: result.score,
        position,
        isCurrentUser: user.id === currentUserId,
    };
}

/**
 * Fallback for users who haven't participated in the current week's
 * competition. Prevents 404 crashes on the dashboard and leaderboard.
 */
async function fallbackCurrentUser(userId: string): Promise<LeaderboardUser> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
    });
    if (!user) throw new TrackingError("Leaderboard account was not found.", 404);

    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        useInitials: user.useInitials,
        arenaScore: user.arenaScore,
        seasonPoints: user.seasonPoints,
        activeDays: user.activeDays,
        rank: user.rank,
        competitionScore: 0,
        position: 0,
        isCurrentUser: true,
    };
}

// ── Service ──────────────────────────────────────────────────────

export const leaderboardService = {

    async getLeaderboard(userId: string, requestedLimit = 10): Promise<LeaderboardResponse> {
        const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 10, 1), 50);
        const results = await getOrderedResults();

        const currentIndex = results.findIndex((res) => res.user.id === userId);
        const currentUser = currentIndex >= 0
            ? toLeaderboardUser(results[currentIndex], currentIndex + 1, userId)
            : await fallbackCurrentUser(userId);

        return {
            totalDevelopers: results.length,
            currentUser,
            topPerformers: results.slice(0, limit).map((res, index) =>
                toLeaderboardUser(res, index + 1, userId),
            ),
        };
    },

    async getNearby(userId: string): Promise<LeaderboardNearbyResponse> {
        const results = await getOrderedResults();
        const currentIndex = results.findIndex((res) => res.user.id === userId);

        if (currentIndex < 0) {
            return { currentPosition: 0, entries: [] };
        }

        const start = Math.max(0, Math.min(currentIndex - 1, Math.max(results.length - 3, 0)));
        const entries = results.slice(start, start + 3).map((res, index) =>
            toLeaderboardUser(res, start + index + 1, userId),
        );

        return { currentPosition: currentIndex + 1, entries };
    },

    async search(userId: string, rawQuery: unknown): Promise<LeaderboardSearchResponse> {
        const query = String(rawQuery || "").trim().toLowerCase();
        if (query.length < 2) {
            throw new TrackingError("Enter at least two characters to search the arena.");
        }

        const results = await getOrderedResults();
        const searchResults = results
            .map((res, index) => ({ res, position: index + 1 }))
            .filter(({ res }) => {
                const user = res.user;
                return user.name.toLowerCase().includes(query) ||
                    user.username.toLowerCase().includes(query.replace(/^@/, "")) ||
                    (user.email && user.email.toLowerCase().includes(query));
            })
            .slice(0, 10)
            .map(({ res, position }) => toLeaderboardUser(res, position, userId));

        return { query, results: searchResults };
    },
};
