import { MS_PER_DAY } from "./DateConstants";
import {
  HEATMAP_HIGH_ACTIVITY_MIN_COUNT,
  HEATMAP_LOW_ACTIVITY_MIN_COUNT,
  HEATMAP_MAX_ACTIVITY_MIN_COUNT,
  HEATMAP_MEDIUM_ACTIVITY_MIN_COUNT,
  HEATMAP_MONTH_LABELS,
} from "./HeatmapConstants";

export type HeatmapCellLevel = "" | "low" | "medium" | "high" | "max";

export type BaseHeatmapCell = {
  count: number;
  date: string;
  day: number;
  month: number;
  weekIndex: number;
};

export type HeatmapCell = BaseHeatmapCell & {
  level: HeatmapCellLevel;
  title: string;
};

export type HeatmapMonthMarker = {
  date: string;
  label: string;
  weekIndex: number;
};

type HeatmapTitleBuilder = (date: string, count: number) => string;

export function buildHeatmapCells(
  baseCells: BaseHeatmapCell[],
  activityCountsByDate: Map<string, number>,
  buildTitle: HeatmapTitleBuilder,
): HeatmapCell[] {
  return baseCells.map((cell) => {
    const count = activityCountsByDate.get(cell.date) || 0;

    return {
      ...cell,
      count,
      level: getHeatmapCellLevel(count),
      title: buildTitle(cell.date, count),
    };
  });
}

export function buildHeatmapMonthMarkers(heatmap: HeatmapCell[]): HeatmapMonthMarker[] {
  return heatmap
    .filter((cell) => cell.day === 1)
    .map((cell) => ({
      date: cell.date,
      label: HEATMAP_MONTH_LABELS[cell.month],
      weekIndex: cell.weekIndex,
    }));
}

export function buildRollingHeatmapDays(pastWeeks: number): BaseHeatmapCell[] {
  const today = new Date();
  const startDate = getRollingHeatmapStartDate(today, pastWeeks);

  return buildHeatmapDaysBetween(startDate, today);
}

export function buildYearHeatmapDays(year: number): BaseHeatmapCell[] {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  return buildHeatmapDaysBetween(startDate, endDate);
}

export function countItemsByDate<T>(
  items: T[],
  getItemDate: (item: T) => Date | null | undefined,
) {
  const activityCountsByDate = new Map<string, number>();

  items.forEach((item) => {
    const date = getItemDate(item);

    if (!date || Number.isNaN(date.getTime())) {
      return;
    }

    const dateKey = formatDateKey(date);
    activityCountsByDate.set(dateKey, (activityCountsByDate.get(dateKey) || 0) + 1);
  });

  return activityCountsByDate;
}

export function findMostActiveDateFromCounts(activityCountsByDate: Map<string, number>) {
  let highestCount = 0;
  let highestDate = "";

  activityCountsByDate.forEach((count, date) => {
    if (count > highestCount) {
      highestCount = count;
      highestDate = date;
    }
  });

  return highestDate;
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildHeatmapDaysBetween(startDate: Date, endDate: Date): BaseHeatmapCell[] {
  const days: BaseHeatmapCell[] = [];
  const current = new Date(startDate);

  current.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    days.push({
      count: 0,
      date: formatDateKey(current),
      day: current.getDate(),
      month: current.getMonth(),
      weekIndex: calculateWeekIndex(startDate, current),
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function calculateWeekIndex(startDate: Date, currentDate: Date) {
  return Math.floor((currentDate.getTime() - startDate.getTime()) / (MS_PER_DAY * 7));
}

function getRollingHeatmapStartDate(today: Date, pastWeeks: number) {
  const startDate = new Date(today);
  const dayOfWeek = today.getDay();

  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(today.getDate() - (pastWeeks * 7 + dayOfWeek));

  return startDate;
}

function getHeatmapCellLevel(count: number): HeatmapCellLevel {
  if (count >= HEATMAP_MAX_ACTIVITY_MIN_COUNT) return "max";
  if (count >= HEATMAP_HIGH_ACTIVITY_MIN_COUNT) return "high";
  if (count >= HEATMAP_MEDIUM_ACTIVITY_MIN_COUNT) return "medium";
  if (count >= HEATMAP_LOW_ACTIVITY_MIN_COUNT) return "low";

  return "";
}
