import { apiRequest } from "./ApiClient";

export type LeaderboardEntry = {
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
  competitionScore: number;
  position: number;
  isCurrentUser: boolean;
};

export type LeaderboardData = {
  totalDevelopers: number;
  currentUser: LeaderboardEntry;
  topPerformers: LeaderboardEntry[];
};

export type NearbyLeaderboardData = {
  currentPosition: number;
  entries: LeaderboardEntry[];
};

export function getLeaderboard(limit = 10) {
  return apiRequest<LeaderboardData>(`/api/leaderboard?limit=${limit}`);
}

export function getNearbyLeaderboard() {
  return apiRequest<NearbyLeaderboardData>("/api/leaderboard/nearby");
}

export function searchLeaderboard(query: string) {
  return apiRequest<{ query: string; results: LeaderboardEntry[] }>(
    `/api/leaderboard/search?q=${encodeURIComponent(query)}`,
  );
}
