import {
  getNextRank,
  getRankFromPoints,
  getRankProgress,
} from "../features/dashboard/utils/RankSystem";
import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";
import {
  ACTIVE_DAY_MIN_LOGS,
  BASE_ACTIVE_DAY_POINTS,
  EXTRA_LOG_POINTS,
  HEATMAP_PAST_WEEKS,
  SEASON_LENGTH_DAYS,
  SEASON_STREAK_BONUS_DAYS,
  SEASON_STREAK_BONUS_POINTS,
  WEEKLY_STREAK_BONUS_DAYS,
  WEEKLY_STREAK_BONUS_POINTS,
} from "./DashboardConstants";
import { MS_PER_DAY } from "./DateConstants";
import {
  buildHeatmapCells,
  buildHeatmapMonthMarkers,
  buildRollingHeatmapDays,
  countItemsByDate,
  findMostActiveDateFromCounts,
  formatDateKey,
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

type DashboardUpdatePayload = {
  activeDays?: number;
  arenaScore?: number;
  rank?: string;
  resetSeason?: boolean;
  seasonBonusClaimed?: boolean;
  seasonNumber?: number;
  seasonPoints?: number;
  streak?: number;
  weeklyBonusClaimed?: boolean;
};

type SeasonSummary = {
  daysRemaining: number;
  hasExpired: boolean;
  seasonNumber: number;
};

type SeasonBonuses = {
  bonusPoints: number;
  seasonBonusClaimed: boolean;
  weeklyBonusClaimed: boolean;
};

type ProgressionSummary = {
  activeDays: number;
  rank: string;
  seasonBonusClaimed: boolean;
  seasonPoints: number;
  streak: number;
  weeklyBonusClaimed: boolean;
};

type RankDisplaySummary = {
  currentRankMaxPoints: number;
  nextRank: string;
  rankProgress: number;
  remainingPoints: number;
};

export type DashboardLog = {
  createdAt: Date;
  id: string;
  text: string;
};

export type DashboardViewModel = {
  activeDays: number;
  arenaScore: number;
  currentRankMaxPoints: number;
  daysRemaining: number;
  heatmap: HeatmapCell[];
  heatmapMonthMarkers: HeatmapMonthMarker[];
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
};

export async function getDashboardViewModel(): Promise<DashboardViewModel> {
  const token = getRequiredDashboardAuthToken();
  const response = await fetchDashboardData(token);
  const viewModel = buildDashboardViewModel(response);

  syncExpiredSeasonIfNeeded(token, response.stats, viewModel);
  syncProgressionStatsIfNeeded(token, response.stats, viewModel);

  return viewModel;
}

async function fetchDashboardData(token: string): Promise<BackendDashboardResponse> {
  const response = await fetch("/api/dashboard/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard");
  }

  return response.json();
}

async function updateDashboardStats(token: string, payload: DashboardUpdatePayload) {
  const response = await fetch("/api/dashboard/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update dashboard");
  }
}

function buildDashboardViewModel(response: BackendDashboardResponse): DashboardViewModel {
  const { stats } = response;
  const logs = mapBackendLogsToDashboardLogs(response.logs);
  const seasonSummary = buildSeasonSummary(stats);
  const progressionSummary = buildProgressionSummary(logs, stats);
  const rankDisplaySummary = buildRankDisplaySummary(progressionSummary.seasonPoints);
  const heatmap = buildHeatmap(logs);
  const heatmapMonthMarkers = buildHeatmapMonthMarkers(heatmap);

  return {
    activeDays: progressionSummary.activeDays,
    arenaScore: normalizeNumber(stats.arenaScore, 0),
    currentRankMaxPoints: rankDisplaySummary.currentRankMaxPoints,
    daysRemaining: seasonSummary.daysRemaining,
    heatmap,
    heatmapMonthMarkers,
    logs,
    mostActiveDay: findMostActiveDate(logs),
    nextRank: rankDisplaySummary.nextRank,
    rank: progressionSummary.rank,
    rankProgress: rankDisplaySummary.rankProgress,
    recentLogs: getRecentLogs(logs),
    remainingPoints: rankDisplaySummary.remainingPoints,
    seasonNumber: seasonSummary.seasonNumber,
    seasonPoints: progressionSummary.seasonPoints,
    streak: progressionSummary.streak,
    totalLogs: logs.length,
  };
}

function getRequiredDashboardAuthToken() {
  const token = getStoredAuthToken();

  if (!token) {
    throw new Error("Dashboard auth token is missing");
  }

  return token;
}

function mapBackendLogsToDashboardLogs(logs: BackendDashboardLog[]): DashboardLog[] {
  return logs.map((log) => ({
    id: log.id,
    text: log.text,
    createdAt: new Date(log.createdAt),
  }));
}

function buildSeasonSummary(stats: BackendDashboardStats): SeasonSummary {
  const seasonAge = calculateSeasonAge(stats.seasonStartDate);
  const hasExpired = seasonAge > SEASON_LENGTH_DAYS;
  const seasonNumber = calculateDisplayedSeasonNumber(stats.seasonNumber, hasExpired);

  return {
    daysRemaining: calculateDaysRemaining(seasonAge),
    hasExpired,
    seasonNumber,
  };
}

function calculateSeasonAge(seasonStartDate: BackendDashboardStats["seasonStartDate"]) {
  if (!seasonStartDate) {
    return 0;
  }

  const startDate = new Date(seasonStartDate);

  if (Number.isNaN(startDate.getTime())) {
    return 0;
  }

  return Math.floor((Date.now() - startDate.getTime()) / MS_PER_DAY);
}

function calculateDaysRemaining(seasonAge: number) {
  return Math.max(SEASON_LENGTH_DAYS - seasonAge, 0);
}

function calculateDisplayedSeasonNumber(
  backendSeasonNumber: BackendDashboardStats["seasonNumber"],
  hasExpired: boolean,
) {
  const seasonNumber = normalizeNumber(backendSeasonNumber, 1);

  return hasExpired ? seasonNumber + 1 : seasonNumber;
}

function buildProgressionSummary(
  logs: DashboardLog[],
  stats: BackendDashboardStats,
): ProgressionSummary {
  if (logs.length === 0) {
    return {
      activeDays: normalizeNumber(stats.activeDays, 0),
      rank: stats.rank || "Unranked",
      seasonBonusClaimed: Boolean(stats.seasonBonusClaimed),
      seasonPoints: normalizeNumber(stats.seasonPoints, 0),
      streak: normalizeNumber(stats.streak, 0),
      weeklyBonusClaimed: Boolean(stats.weeklyBonusClaimed),
    };
  }

  const dailyLogCounts = countLogsByDate(logs);
  const activeDates = getActiveDates(dailyLogCounts);
  const streak = calculateCurrentStreak(activeDates);
  const bonuses = calculateSeasonBonuses(streak);
  const seasonPoints = calculateSeasonPoints(activeDates, dailyLogCounts, bonuses);
  const rank = getRankFromPoints(seasonPoints).name;

  return {
    activeDays: activeDates.length,
    rank,
    seasonBonusClaimed: bonuses.seasonBonusClaimed,
    seasonPoints,
    streak,
    weeklyBonusClaimed: bonuses.weeklyBonusClaimed,
  };
}

function countLogsByDate(logs: DashboardLog[]) {
  return countItemsByDate(logs, (log) => log.createdAt);
}

function getActiveDates(dailyLogCounts: Map<string, number>) {
  return Array.from(dailyLogCounts.entries())
    .filter(([, count]) => count >= ACTIVE_DAY_MIN_LOGS)
    .map(([date]) => date)
    .sort()
    .reverse();
}

function calculateCurrentStreak(activeDates: string[]) {
  const activeDateSet = new Set(activeDates);
  const cursor = new Date();
  let streak = 0;

  cursor.setHours(0, 0, 0, 0);

  while (activeDateSet.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function calculateSeasonBonuses(streak: number): SeasonBonuses {
  const weeklyBonusClaimed = streak >= WEEKLY_STREAK_BONUS_DAYS;
  const seasonBonusClaimed = streak >= SEASON_STREAK_BONUS_DAYS;

  return {
    bonusPoints:
      (weeklyBonusClaimed ? WEEKLY_STREAK_BONUS_POINTS : 0) +
      (seasonBonusClaimed ? SEASON_STREAK_BONUS_POINTS : 0),
    seasonBonusClaimed,
    weeklyBonusClaimed,
  };
}

function calculateSeasonPoints(
  activeDates: string[],
  dailyLogCounts: Map<string, number>,
  bonuses: SeasonBonuses,
) {
  const activityPoints = activeDates.reduce((points, date) => {
    const logsOnDay = dailyLogCounts.get(date) || 0;
    const extraLogPoints = Math.max(logsOnDay - ACTIVE_DAY_MIN_LOGS, 0) * EXTRA_LOG_POINTS;

    return points + BASE_ACTIVE_DAY_POINTS + extraLogPoints;
  }, 0);

  return activityPoints + bonuses.bonusPoints;
}

function buildRankDisplaySummary(seasonPoints: number): RankDisplaySummary {
  const nextRank = getNextRank(seasonPoints);

  return {
    currentRankMaxPoints: nextRank ? nextRank.points : seasonPoints,
    nextRank: nextRank?.name ?? "Developer",
    rankProgress: getRankProgress(seasonPoints),
    remainingPoints: nextRank ? Math.max(nextRank.points - seasonPoints, 0) : 0,
  };
}

function buildHeatmap(logs: DashboardLog[]): HeatmapCell[] {
  const rollingDays = buildRollingHeatmapDays(HEATMAP_PAST_WEEKS);
  const dailyLogCounts = countLogsByDate(logs);

  return buildHeatmapCells(rollingDays, dailyLogCounts, buildDashboardHeatmapCellTitle);
}

function findMostActiveDate(logs: DashboardLog[]) {
  const dailyLogCounts = countLogsByDate(logs);

  return findMostActiveDateFromCounts(dailyLogCounts);
}

function buildDashboardHeatmapCellTitle(date: string, count: number) {
  if (count === 0) {
    return `No activity on ${date}`;
  }

  return `${count} activities pushed to the Arena on ${date}`;
}

function getRecentLogs(logs: DashboardLog[]) {
  return logs.slice(0, 5);
}

function syncExpiredSeasonIfNeeded(
  token: string,
  stats: BackendDashboardStats,
  viewModel: DashboardViewModel,
) {
  const seasonSummary = buildSeasonSummary(stats);

  if (!seasonSummary.hasExpired) {
    return;
  }

  void updateDashboardStats(token, {
    activeDays: 0,
    rank: "Unranked",
    resetSeason: true,
    seasonBonusClaimed: false,
    seasonNumber: viewModel.seasonNumber,
    seasonPoints: 0,
    streak: 0,
    weeklyBonusClaimed: false,
  }).catch(console.error);
}

function syncProgressionStatsIfNeeded(
  token: string,
  stats: BackendDashboardStats,
  viewModel: DashboardViewModel,
) {
  if (!shouldSyncProgressionStats(stats, viewModel)) {
    return;
  }

  void updateDashboardStats(token, {
    activeDays: viewModel.activeDays,
    rank: viewModel.rank,
    seasonBonusClaimed: viewModel.streak >= SEASON_STREAK_BONUS_DAYS,
    seasonPoints: viewModel.seasonPoints,
    streak: viewModel.streak,
    weeklyBonusClaimed: viewModel.streak >= WEEKLY_STREAK_BONUS_DAYS,
  }).catch(console.error);
}

function shouldSyncProgressionStats(
  stats: BackendDashboardStats,
  viewModel: DashboardViewModel,
) {
  if (viewModel.totalLogs === 0) {
    return false;
  }

  return (
    normalizeNumber(stats.streak, 0) !== viewModel.streak ||
    normalizeNumber(stats.activeDays, 0) !== viewModel.activeDays ||
    normalizeNumber(stats.seasonPoints, 0) !== viewModel.seasonPoints ||
    (stats.rank || "Unranked") !== viewModel.rank
  );
}

function normalizeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === "number" ? value : fallback;
}
