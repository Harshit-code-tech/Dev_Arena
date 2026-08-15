import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type TournamentTab = "Live" | "Upcoming" | "Completed" | "My Tournaments" | "Leaderboard";
export type TournamentType = "DSA" | "Project";

export type TournamentSummary = {
  id: string;
  title: string;
  slug: string;
  description: string;
  rules: string;
  type: TournamentType;
  mode: "Solo" | "Team" | "Both";
  status: string;
  effectiveStatus: string;
  difficulty: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
  teamSizeMin: number;
  teamSizeMax: number;
  maxParticipants: number | null;
  allowedLanguages: string[];
  theme: string | null;
  requiredFeatures: string | null;
  submissionChecklist: string | null;
  requireDeployment: boolean;
  _count: { registrations: number; teams: number; questions: number };
  registration: TournamentRegistration | null;
};

export type TournamentRegistration = {
  id: string;
  participationMode: string;
  status: string;
  teamId: string | null;
  finalScore: number;
  finalRank: number | null;
  team?: {
    id: string;
    name: string;
    joinCode: string;
    status: string;
    members: Array<{ user: { id: string; name: string; username: string; topTechStack: unknown } }>;
  } | null;
};

export type TournamentQuestion = {
  id: string;
  title: string;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  examples: unknown;
  visibleTestCases: unknown;
  difficulty: "Easy" | "Medium" | "Hard";
  points: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages: string[];
  orderIndex: number;
};

export type TournamentDetail = TournamentSummary & {
  projectSubmission: null | {
    id: string; repositoryUrl: string; repositoryPrivate: boolean | null; deploymentUrl: string | null; demoVideoUrl: string | null; notes: string | null;
    status: string; automatedScore: number; manualScore: number; finalScore: number; baselineCommitSha: string | null; finalCommitSha: string | null;
    baselineSourceBytes: number; finalSourceBytes: number; baselineCapturedAt: string | null; submittedAt: string | null; lastGithubRefreshAt: string | null;
  };
  questions: TournamentQuestion[];
  announcements: Array<{ id: string; title: string; message: string; createdAt: string; author: { name: string; username: string } }>;
};


export type TournamentLeaderboardRow = {
  rank: number;
  score: number;
  arenaPointsAwarded?: number;
  solved?: number;
  penalty?: number;
  participationMode?: string;
  isCurrentUser?: boolean;
  user?: { id: string; name: string; username: string; avatarUrl?: string | null; rank?: string; topTechStack?: unknown };
  team?: { id: string; name: string } | null;
  submission?: {
    id: string;
    finalScore: number;
    automatedScore: number;
    manualScore: number;
    user?: { id: string; name: string; username: string; avatarUrl?: string | null; rank?: string } | null;
    team?: { id: string; name: string; members?: Array<{ user: { id: string; name: string; username: string } }> } | null;
  };
};

export type TournamentLeaderboardGroup = {
  id: string;
  title: string;
  type: TournamentType;
  status: string;
  effectiveStatus: string;
  startsAt: string;
  endsAt: string;
  resultsPublishedAt: string | null;
  leaderboardFrozen?: boolean;
  rows: TournamentLeaderboardRow[];
};

type Envelope<T> = { success: boolean; data: T; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({})) as Partial<Envelope<T>>;
  if (!response.ok || !payload.success || payload.data === undefined) throw new Error(payload.message || "Tournament request failed.");
  return payload.data;
}

export const TournamentApi = {
  list: (tab: TournamentTab) => request<TournamentSummary[]>(`/api/tournaments?tab=${encodeURIComponent(tab)}`),
  detail: (id: string) => request<TournamentDetail>(`/api/tournaments/${encodeURIComponent(id)}`),
  globalLeaderboard: () => request<TournamentLeaderboardGroup[]>("/api/tournaments/leaderboard"),
  leaderboard: (id: string) => request<TournamentLeaderboardRow[]>(`/api/tournaments/${encodeURIComponent(id)}/leaderboard`),
  register: (id: string, input: { participationMode: string; teamCode?: string; preferredRole?: string; availability?: string }) => request<TournamentRegistration>(`/api/tournaments/${encodeURIComponent(id)}/register`, { method: "POST", body: JSON.stringify(input) }),
  submitDsa: (id: string, input: { questionId: string; language: string; code: string }) => request<unknown>(`/api/tournaments/${encodeURIComponent(id)}/dsa-submissions`, { method: "POST", body: JSON.stringify(input) }),
  saveProject: (id: string, input: { repositoryUrl: string; deploymentUrl?: string; demoVideoUrl?: string; notes?: string; finalize?: boolean }) => request<unknown>(`/api/tournaments/${encodeURIComponent(id)}/project-submission`, { method: "POST", body: JSON.stringify(input) }),
};
