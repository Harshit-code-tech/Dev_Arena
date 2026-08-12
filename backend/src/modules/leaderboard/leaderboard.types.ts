export type LeaderboardUser = {
    id: string;
    name: string;
    username: string;
    email: string | null;
    avatarUrl: string | null;
    useInitials: boolean;
    arenaScore: number;
    seasonPoints: number;
    activeDays: number;
    rank: string;
    position: number;
    isCurrentUser: boolean;
};

export type LeaderboardResponse = {
    totalDevelopers: number;
    currentUser: LeaderboardUser;
    topPerformers: LeaderboardUser[];
};

export type LeaderboardSearchResponse = {
    query: string;
    results: LeaderboardUser[];
};

export type LeaderboardNearbyResponse = {
    currentPosition: number;
    entries: LeaderboardUser[];
};
