import type { Difficulty, Prisma } from "@prisma/client";
import { formatDateKey } from "../../shared/utils/tracking";

export type DsaScoringLog = {
  id: string;
  problemName: string;
  difficulty: Difficulty;
  activityDate: Date;
  createdAt: Date;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function scoringDateKey(date: Date) {
  return formatDateKey(new Date(date.getTime() + IST_OFFSET_MS));
}

function roundPoint(value: number) {
  return Math.round(value * 10) / 10;
}

export function dsaPointsForDailyOrdinal(difficulty: Difficulty, ordinal: number) {
  if (difficulty === "Hard") return 10;
  if (difficulty === "Medium") {
    if (ordinal <= 5) return 4;
    if (ordinal <= 10) return 3;
    if (ordinal <= 15) return 2;
    return 0;
  }
  if (ordinal <= 3) return 1;
  if (ordinal <= 7) return 0.5;
  if (ordinal <= 10) return 0.2;
  return 0;
}

export function calculateDsaPoints(logs: DsaScoringLog[]) {
  const ordered = [...logs].sort((left, right) => {
    const activityDifference = left.activityDate.getTime() - right.activityDate.getTime();
    return activityDifference || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
  });
  const counters = new Map<string, number>();
  const points = new Map<string, number>();

  for (const log of ordered) {
    const key = `${scoringDateKey(log.activityDate)}:${log.difficulty}`;
    const ordinal = (counters.get(key) || 0) + 1;
    counters.set(key, ordinal);
    points.set(log.id, roundPoint(dsaPointsForDailyOrdinal(log.difficulty, ordinal)));
  }
  return points;
}

export async function rebuildDsaScoreEvents(tx: Prisma.TransactionClient, userId: string) {
  const logs = await tx.dSALog.findMany({
    where: { userId },
    orderBy: [{ activityDate: "asc" }, { createdAt: "asc" }],
    select: { id: true, problemName: true, difficulty: true, activityDate: true, createdAt: true },
  });
  const pointsById = calculateDsaPoints(logs);

  await tx.scoreEvent.deleteMany({ where: { userId, sourceType: "DSA_LOG" } });
  if (logs.length) {
    await tx.scoreEvent.createMany({
      data: logs.map((log) => ({
        userId,
        category: "DSA",
        sourceType: "DSA_LOG",
        sourceId: log.id,
        label: `DSA: ${log.problemName}`,
        points: pointsById.get(log.id) || 0,
        occurredAt: log.activityDate,
      })),
    });
  }
  return pointsById;
}
