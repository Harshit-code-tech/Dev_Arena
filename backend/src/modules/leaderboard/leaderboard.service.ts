import { prisma } from "../../database/prisma";
import { TrackingError } from "../../shared/utils/tracking";
import type {
    LeaderboardNearbyResponse,
    LeaderboardResponse,
    LeaderboardSearchResponse,
    LeaderboardUser,
} from "./leaderboard.types";

const leaderboardSelect = {
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
    createdAt: true,
} as const;

type RankedUser = Awaited<ReturnType<typeof getOrderedUsers>>[number];

async function getOrderedUsers() {
    return prisma.user.findMany({
        select: leaderboardSelect,
        orderBy: [
            { arenaScore: "desc" },
            { seasonPoints: "desc" },
            { activeDays: "desc" },
            { createdAt: "asc" },
            { id: "asc" },
        ],
    });
}

function toLeaderboardUser(user: RankedUser, position: number, currentUserId: string): LeaderboardUser {
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
        position,
        isCurrentUser: user.id === currentUserId,
    };
}

function findCurrentPosition(users: RankedUser[], userId: string) {
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) throw new TrackingError("Leaderboard account was not found.", 404);
    return index;
}

export const leaderboardService = {
    async getLeaderboard(userId: string, requestedLimit = 10): Promise<LeaderboardResponse> {
        const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 10, 1), 50);
        const users = await getOrderedUsers();
        const currentIndex = findCurrentPosition(users, userId);

        return {
            totalDevelopers: users.length,
            currentUser: toLeaderboardUser(users[currentIndex], currentIndex + 1, userId),
            topPerformers: users.slice(0, limit).map((user, index) =>
                toLeaderboardUser(user, index + 1, userId),
            ),
        };
    },

    async getNearby(userId: string): Promise<LeaderboardNearbyResponse> {
        const users = await getOrderedUsers();
        const currentIndex = findCurrentPosition(users, userId);
        const start = Math.max(0, Math.min(currentIndex - 1, Math.max(users.length - 3, 0)));
        const entries = users.slice(start, start + 3).map((user, index) =>
            toLeaderboardUser(user, start + index + 1, userId),
        );

        return {
            currentPosition: currentIndex + 1,
            entries,
        };
    },

    async search(userId: string, rawQuery: unknown): Promise<LeaderboardSearchResponse> {
        const query = String(rawQuery || "").trim().toLowerCase();
        if (query.length < 2) {
            throw new TrackingError("Enter at least two characters to search the arena.");
        }

        const users = await getOrderedUsers();
        const results = users
            .map((user, index) => ({ user, position: index + 1 }))
            .filter(({ user }) =>
                user.name.toLowerCase().includes(query) ||
                user.username.toLowerCase().includes(query.replace(/^@/, "")) ||
                user.email.toLowerCase().includes(query),
            )
            .slice(0, 10)
            .map(({ user, position }) => toLeaderboardUser(user, position, userId));

        return { query, results };
    },
};
