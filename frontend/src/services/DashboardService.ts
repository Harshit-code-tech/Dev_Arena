import {
  getNextRank,
  getRankFromPoints,
  getRankProgress,
} from "../features/dashboard/utils/RankSystem";
import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";
import {
  getLeaderboard,
  type LeaderboardEntry,
} from "./LeaderboardService";
import { HEATMAP_PAST_WEEKS, SEASON_LENGTH_DAYS } from "./DashboardConstants";
import { MS_PER_DAY } from "./DateConstants";
import {
  buildHeatmapCells,
  buildHeatmapMonthMarkers,
  buildRollingHeatmapDays,
  countItemsByDate,
  findMostActiveDateFromCounts,
  type HeatmapCell,
  type HeatmapMonthMarker,
} from "./HeatmapService";

type BackendDashboardStats = {
  arenaScore?: number | null;
  streak?: number | null;
  activeDays?: number | null;
  seasonPoints?: number | null;
  seasonNumber?: number | null;
  rank?: string | null;
  seasonStartDate?: string | Date | null;
  weeklyBonusClaimed?: boolean | null;
  seasonBonusClaimed?: boolean | null;
  weeklyActiveDays?: number | null;
  consistencyRating?: string | null;
};

type BackendDashboardLog = {
  id: string;
  text: string;
  createdAt: string | Date;
};

type BackendDashboardResponse = {
  stats: BackendDashboardStats;
  logs: BackendDashboardLog[];
};


export type DashboardLog = {
  createdAt: Date;
  id: string;
  text: string;
};

export type DashboardViewModel = {
  activeDays: number;
  arenaScore: number;
  consistencyRating: string;
  currentRankMaxPoints: number;
  daysRemaining: number;
  heatmap: HeatmapCell[];
  heatmapMonthMarkers: HeatmapMonthMarker[];
  leaderboardPreview: LeaderboardEntry[];
  logs: DashboardLog[];
  mostActiveDay: string;
  nextRank: string;
  rank: string;
  rankProgress: number;
  recentLogs: DashboardLog[];
  remainingPoints: number;
  seasonNumber: number;
  seasonPoints: number;
  streak: number;
  totalLogs: number;
  weeklyActiveDays: number;
};

export async function getDashboardViewModel(): Promise<DashboardViewModel> {
  const token = getRequiredDashboardAuthToken();
  const [response, leaderboard] = await Promise.all([
    fetchDashboardData(token),
    getLeaderboard(3).catch(() => ({ totalDevelopers: 0, currentUser: null, topPerformers: [] })),
  ]);
  const viewModel = buildDashboardViewModel(response, leaderboard.topPerformers);

  return viewModel;
}

async function fetchDashboardData(
  token: string,
): Promise<BackendDashboardResponse> {
  const response = await fetch("/api/dashboard/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to fetch dashboard");
  return response.json();
}


function buildDashboardViewModel(
  response: BackendDashboardResponse,
  leaderboardPreview: LeaderboardEntry[],
): DashboardViewModel {
  const logs = response.logs.map((log) => ({
    id: log.id,
    text: log.text,
    createdAt: new Date(log.createdAt),
  }));
  const seasonPoints = normalizeNumber(response.stats.seasonPoints, 0);
  const backendRank =
    response.stats.rank || getRankFromPoints(seasonPoints).name;
  const nextRank = getNextRank(seasonPoints);
  const heatmap = buildHeatmap(logs);

  return {
    activeDays: normalizeNumber(response.stats.activeDays, 0),
    arenaScore: normalizeNumber(response.stats.arenaScore, 0),
    consistencyRating: response.stats.consistencyRating || "Low",
    currentRankMaxPoints: nextRank?.points ?? seasonPoints,
    daysRemaining: calculateDaysRemaining(response.stats.seasonStartDate),
    heatmap,
    heatmapMonthMarkers: buildHeatmapMonthMarkers(heatmap),
    leaderboardPreview,
    logs,
    mostActiveDay: findMostActiveDate(logs),
    nextRank: nextRank?.name ?? "Developer",
    rank: backendRank,
    rankProgress: getRankProgress(seasonPoints),
    recentLogs: logs.slice(0, 10),
    remainingPoints: nextRank ? Math.max(nextRank.points - seasonPoints, 0) : 0,
    seasonNumber: normalizeNumber(response.stats.seasonNumber, 1),
    seasonPoints,
    streak: normalizeNumber(response.stats.streak, 0),
    totalLogs: logs.length,
    weeklyActiveDays: normalizeNumber(response.stats.weeklyActiveDays, 0),
  };
}

function getRequiredDashboardAuthToken() {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Dashboard auth token is missing");
  return token;
}

function calculateDaysRemaining(
  seasonStartDate: BackendDashboardStats["seasonStartDate"],
) {
  if (!seasonStartDate) return SEASON_LENGTH_DAYS;
  const start = new Date(seasonStartDate);
  if (Number.isNaN(start.getTime())) return SEASON_LENGTH_DAYS;
  const end = start.getTime() + SEASON_LENGTH_DAYS * MS_PER_DAY;
  const remaining = Math.ceil((end - Date.now()) / MS_PER_DAY);
  return Math.min(SEASON_LENGTH_DAYS, Math.max(remaining, 0));
}

function buildHeatmap(logs: DashboardLog[]) {
  const rollingDays = buildRollingHeatmapDays(HEATMAP_PAST_WEEKS);
  const dailyLogCounts = countItemsByDate(logs, (log) => log.createdAt);

  return buildHeatmapCells(rollingDays, dailyLogCounts, (date, count) =>
    count === 0
      ? `No activity on ${date}`
      : `${count} structured activities on ${date}`,
  );
}

function findMostActiveDate(logs: DashboardLog[]) {
  return findMostActiveDateFromCounts(
    countItemsByDate(logs, (log) => log.createdAt),
  );
}


function normalizeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === "number"
    ? Math.round((value + Number.EPSILON) * 100) / 100
    : fallback;
}
