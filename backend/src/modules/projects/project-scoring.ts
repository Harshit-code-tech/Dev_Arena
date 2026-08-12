import type { Prisma } from "@prisma/client";
import { rebuildUserScoreState } from "../../shared/services/scoring.service";

export const PROJECT_SCORE_VERSION = "project-evidence-v2";

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sourceBytes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => {
    const number = Number(item);
    return sum + (Number.isFinite(number) && number > 0 ? number : 0);
  }, 0);
}

export type ProjectScoreBreakdown = {
  verified: number;
  codeSize: number;
  contribution: number;
  workSessions: number;
  milestones: number;
  completion: number;
  total: number;
  sourceBytes: number;
  repositorySizeKb: number;
};

export function calculateProjectScore(project: {
  githubEligibleForTechStack: boolean;
  githubContributionWeight: number | null;
  githubLanguageBytes: unknown;
  githubSourceBytes: number | null;
  githubRepositorySizeKb: number | null;
  completionAwardedAt: Date | null;
  logs: Array<{ activityDate: Date }>;
  milestones: Array<{ completionAwardedAt: Date | null }>;
}): ProjectScoreBreakdown {
  const bytes = Math.max(0, Number(project.githubSourceBytes) || sourceBytes(project.githubLanguageBytes));
  const repositorySizeKb = Math.max(0, Number(project.githubRepositorySizeKb) || 0);
  if (!project.githubEligibleForTechStack || bytes <= 0) {
    return { verified: 0, codeSize: 0, contribution: 0, workSessions: 0, milestones: 0, completion: 0, total: 0, sourceBytes: bytes, repositorySizeKb };
  }

  const weight = clamp(Number(project.githubContributionWeight) || 0, 0, 1);
  const effectiveBytes = bytes * weight;
  const maturity = clamp(Math.sqrt(effectiveBytes / 250_000), 0, 1);
  const completionMaturity = clamp(Math.sqrt(effectiveBytes / 500_000), 0, 1);
  const verified = effectiveBytes >= 100_000 ? 5 : 3;
  const codeSize = clamp(3.5 * Math.log10(1 + effectiveBytes / 1_000), 0, 15);
  const contribution = clamp(10 * weight * maturity, 0, 10);
  const workSessions = clamp(project.logs.length, 0, 10);
  const completedMilestones = project.milestones.filter((item) => item.completionAwardedAt !== null).length;
  const milestones = clamp(completedMilestones * 3, 0, 15);
  const hasSustainedEvidence = project.logs.length > 0 || completedMilestones > 0;
  const completion = project.completionAwardedAt && hasSustainedEvidence
    ? clamp(15 * completionMaturity, 0, 15)
    : 0;
  const values = { verified, codeSize, contribution, workSessions, milestones, completion };
  const rounded = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, roundScore(value)])) as typeof values;
  return {
    ...rounded,
    total: roundScore([rounded.verified, rounded.codeSize, rounded.contribution, rounded.workSessions, rounded.milestones, rounded.completion].reduce((sum, value) => sum + value, 0)),
    sourceBytes: bytes,
    repositorySizeKb,
  };
}

export async function rebuildProjectScoreEvents(
  tx: Prisma.TransactionClient,
  userId: string,
  projectId: string,
  rebuildUser = true,
) {
  const project = await tx.project.findFirst({
    where: { id: projectId, userId },
    include: {
      logs: { select: { id: true, activityDate: true } },
      milestones: { select: { id: true, completionAwardedAt: true, updatedAt: true } },
    },
  });
  if (!project) return null;

  const breakdown = calculateProjectScore(project);
  const logIds = project.logs.map((item) => item.id);
  const milestoneIds = project.milestones.map((item) => item.id);
  await tx.scoreEvent.deleteMany({
    where: {
      userId,
      OR: [
        { sourceType: { in: ["PROJECT_EVIDENCE_SCORE", "PROJECT_ACTIVITY_SCORE", "PROJECT_COMPLETION_SCORE"] }, sourceId: project.id },
        ...(logIds.length ? [{ sourceType: "PROJECT_LOG", sourceId: { in: logIds } }] : []),
        ...(milestoneIds.length ? [{ sourceType: "MILESTONE_COMPLETED", sourceId: { in: milestoneIds } }] : []),
        { sourceType: "PROJECT_COMPLETED", sourceId: project.id },
      ],
    },
  });

  const now = new Date();
  const latestActivity = [
    ...project.logs.map((item) => item.activityDate),
    ...project.milestones.flatMap((item) => item.completionAwardedAt ? [item.completionAwardedAt] : []),
  ].sort((left, right) => right.getTime() - left.getTime())[0] || project.updatedAt;
  const rows = [
    {
      userId,
      category: "Project" as const,
      sourceType: "PROJECT_EVIDENCE_SCORE",
      sourceId: project.id,
      label: `Verified repository evidence: ${project.title}`,
      points: roundScore(breakdown.verified + breakdown.codeSize + breakdown.contribution),
      occurredAt: project.githubVerifiedAt || project.startDate,
    },
    {
      userId,
      category: "Project" as const,
      sourceType: "PROJECT_ACTIVITY_SCORE",
      sourceId: project.id,
      label: `Project activity: ${project.title}`,
      points: roundScore(breakdown.workSessions + breakdown.milestones),
      occurredAt: latestActivity,
    },
    ...(breakdown.completion > 0 ? [{
      userId,
      category: "Project" as const,
      sourceType: "PROJECT_COMPLETION_SCORE",
      sourceId: project.id,
      label: `Project completed: ${project.title}`,
      points: breakdown.completion,
      occurredAt: project.completionAwardedAt || now,
    }] : []),
  ].filter((row) => row.points > 0);
  if (rows.length) await tx.scoreEvent.createMany({ data: rows });
  await tx.project.update({
    where: { id: project.id },
    data: {
      githubSourceBytes: breakdown.sourceBytes,
      projectScore: breakdown.total,
      projectScoreUpdatedAt: now,
      projectScoreVersion: PROJECT_SCORE_VERSION,
    },
  });
  if (rebuildUser) await rebuildUserScoreState(tx, userId);
  return breakdown;
}

export async function rebuildProjectScoresForUser(tx: Prisma.TransactionClient, userId: string) {
  const projects = await tx.project.findMany({ where: { userId }, select: { id: true } });
  for (const project of projects) await rebuildProjectScoreEvents(tx, userId, project.id, false);
  await rebuildUserScoreState(tx, userId);
  return projects.length;
}
