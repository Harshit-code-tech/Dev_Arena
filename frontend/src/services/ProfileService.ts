import {
  buildHeatmapCells,
  buildHeatmapMonthMarkers,
  buildYearHeatmapDays,
  countItemsByDate,
  type HeatmapCell,
  type HeatmapMonthMarker,
} from "./HeatmapService";

type FirestoreTimestampLike = {
  toDate: () => Date;
};

type ProfileActivityLog = {
  createdAt?: Date | FirestoreTimestampLike | string | null;
};

export type ProfileHeatmapViewModel = {
  heatmap: HeatmapCell[];
  heatmapMonthMarkers: HeatmapMonthMarker[];
};

export function buildProfileHeatmapViewModel(
  logs: ProfileActivityLog[],
  selectedYear: number,
): ProfileHeatmapViewModel {
  const yearDays = buildYearHeatmapDays(selectedYear);
  const activityCountsByDate = countItemsByDate(logs, getProfileLogDate);
  const heatmap = buildHeatmapCells(yearDays, activityCountsByDate, buildProfileHeatmapCellTitle);
  const heatmapMonthMarkers = buildHeatmapMonthMarkers(heatmap);

  return {
    heatmap,
    heatmapMonthMarkers,
  };
}

function getProfileLogDate(log: ProfileActivityLog) {
  if (!log.createdAt) {
    return null;
  }

  if (log.createdAt instanceof Date) {
    return log.createdAt;
  }

  if (typeof log.createdAt === "string") {
    return new Date(log.createdAt);
  }

  return log.createdAt.toDate();
}

function buildProfileHeatmapCellTitle(date: string, count: number) {
  if (count === 0) {
    return `No activity on ${date}`;
  }

  return `${count} activities on ${date}`;
}
