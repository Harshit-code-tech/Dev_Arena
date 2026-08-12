import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { publishRealtimeEvent } from "../realtime/realtime.service";

export type TopTechStackItem = {
  name: string;
  percentage: number;
  projectCount: number;
};

export type TopTechStack = {
  items: TopTechStackItem[];
  eligibleProjectCount: number;
  updatedAt: Date | null;
};

type StoredLanguage = { name?: unknown; percentage?: unknown; bytes?: unknown };

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function languageBytes(value: Prisma.JsonValue | null): Record<string, number> {
  if (!value) return {};
  if (Array.isArray(value)) {
    return value.reduce<Record<string, number>>((result, entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return result;
      const language = entry as StoredLanguage;
      const name = typeof language.name === "string" ? language.name.trim() : "";
      const bytes = numeric(language.bytes) || numeric(language.percentage) * 10_000;
      if (name && bytes > 0) result[name] = (result[name] || 0) + bytes;
      return result;
    }, {});
  }
  if (typeof value !== "object") return {};
  return Object.entries(value).reduce<Record<string, number>>((result, [name, bytes]) => {
    const amount = numeric(bytes);
    if (name.trim() && amount > 0) result[name.trim()] = amount;
    return result;
  }, {});
}

function parseStoredStack(value: Prisma.JsonValue | null): TopTechStackItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name : "";
    if (!name) return [];
    return [{
      name,
      percentage: numeric(item.percentage),
      projectCount: Math.max(0, Math.round(numeric(item.projectCount))),
    }];
  }).slice(0, 3);
}

export function topTechStackFromUser(user: {
  topTechStack: Prisma.JsonValue | null;
  topTechStackUpdatedAt: Date | null;
  topTechStackProjectCount: number;
}): TopTechStack {
  return {
    items: parseStoredStack(user.topTechStack),
    eligibleProjectCount: user.topTechStackProjectCount,
    updatedAt: user.topTechStackUpdatedAt,
  };
}

export const techStackService = {
  async getUserTopTechStack(userId: string): Promise<TopTechStack> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        topTechStack: true,
        topTechStackUpdatedAt: true,
        topTechStackProjectCount: true,
      },
    });
    if (!user) return { items: [], eligibleProjectCount: 0, updatedAt: null };
    return topTechStackFromUser(user);
  },

  async rebuildUserTopTechStack(userId: string): Promise<TopTechStack> {
    const [projects, previous] = await Promise.all([
      prisma.project.findMany({
        where: {
          userId,
          githubEligibleForTechStack: true,
          githubRepositoryUrl: { not: null },
        },
        orderBy: { githubContributionVerifiedAt: "desc" },
        select: {
          id: true,
          githubRepositoryId: true,
          githubRepositoryUrl: true,
          githubLanguageBytes: true,
          githubLanguages: true,
          githubContributionWeight: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { topTechStack: true, topTechStackProjectCount: true },
      }),
    ]);

    const seenRepositories = new Set<string>();
    const totals = new Map<string, { bytes: number; projects: Set<string> }>();
    let eligibleProjectCount = 0;

    for (const project of projects) {
      const repositoryKey = project.githubRepositoryId || project.githubRepositoryUrl?.toLowerCase() || project.id;
      if (seenRepositories.has(repositoryKey)) continue;
      seenRepositories.add(repositoryKey);

      const bytes = languageBytes(project.githubLanguageBytes || project.githubLanguages);
      if (Object.keys(bytes).length === 0) continue;
      const weight = Math.max(0, Math.min(1, numeric(project.githubContributionWeight) || 1));
      eligibleProjectCount += 1;

      for (const [name, amount] of Object.entries(bytes)) {
        const effective = amount * weight;
        if (effective <= 0) continue;
        const current = totals.get(name) || { bytes: 0, projects: new Set<string>() };
        current.bytes += effective;
        current.projects.add(project.id);
        totals.set(name, current);
      }
    }

    const aggregateTotal = [...totals.values()].reduce((sum, item) => sum + item.bytes, 0);
    const items: TopTechStackItem[] = [...totals.entries()]
      .sort((left, right) => right[1].bytes - left[1].bytes || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([name, value]) => ({
        name,
        percentage: aggregateTotal > 0 ? Number(((value.bytes / aggregateTotal) * 100).toFixed(2)) : 0,
        projectCount: value.projects.size,
      }));

    const updatedAt = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: {
        topTechStack: items.length ? items as Prisma.InputJsonValue : Prisma.DbNull,
        topTechStackUpdatedAt: updatedAt,
        topTechStackProjectCount: eligibleProjectCount,
      },
    });

    const changed = JSON.stringify(parseStoredStack(previous?.topTechStack || null)) !== JSON.stringify(items)
      || (previous?.topTechStackProjectCount || 0) !== eligibleProjectCount;
    if (changed) {
      await publishRealtimeEvent({
        userId: null,
        type: "profile.changed",
        entityType: "user",
        entityId: userId,
        payload: { topTechStack: items, eligibleProjectCount },
      }).catch(() => undefined);
    }

    return { items, eligibleProjectCount, updatedAt };
  },
};
