import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

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

type Envelope<T> = { success: boolean; data: T; message?: string };

async function authorizedRequest<T>(path: string): Promise<T> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Authentication token is missing.");

  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Could not load leaderboard data.");
  }
  return payload.data;
}

export function getLeaderboard(limit = 10) {
  return authorizedRequest<LeaderboardData>(`/api/leaderboard?limit=${limit}`);
}

export function getNearbyLeaderboard() {
  return authorizedRequest<NearbyLeaderboardData>("/api/leaderboard/nearby");
}

export function searchLeaderboard(query: string) {
  return authorizedRequest<{ query: string; results: LeaderboardEntry[] }>(
    `/api/leaderboard/search?q=${encodeURIComponent(query)}`,
  );
}
