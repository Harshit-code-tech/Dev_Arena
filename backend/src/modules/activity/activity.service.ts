import { prisma } from "../../database/prisma";
import type { DayActivityResponse, DayActivitySection } from "./activity.types";

function httpError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function dayBounds(dateKey: string, timezoneOffsetMinutes: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw httpError("Enter a valid activity date.");
  const [year, month, day] = dateKey.split("-").map(Number);
  const test = new Date(Date.UTC(year, month - 1, day));
  if (test.getUTCFullYear() !== year || test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) {
    throw httpError("Enter a valid activity date.");
  }

  const offset = Number.isFinite(timezoneOffsetMinutes)
    ? Math.min(Math.max(Math.trunc(timezoneOffsetMinutes), -840), 840)
    : 0;
  const start = new Date(Date.UTC(year, month - 1, day) + offset * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function between(start: Date, end: Date) {
  return { gte: start, lt: end } as const;
}

export const activityService = {
  async getDay(userId: string, dateKey: string, timezoneOffsetMinutes: number): Promise<DayActivityResponse> {
    const { start, end } = dayBounds(dateKey, timezoneOffsetMinutes);

    const [scoreEvents, dsa, practice, fullstack, projectWork, milestones, completedProjects, challenges] = await Promise.all([
      prisma.scoreEvent.findMany({
        where: { userId, occurredAt: between(start, end) },
        orderBy: { occurredAt: "desc" },
      }),
      prisma.dSALog.findMany({
        where: { userId, activityDate: between(start, end) },
        orderBy: { createdAt: "desc" },
      }),
      prisma.practiceLog.findMany({
        where: { userId, activityDate: between(start, end) },
        orderBy: { createdAt: "desc" },
      }),
      prisma.fullstackLog.findMany({
        where: { userId, activityDate: between(start, end) },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectLog.findMany({
        where: { userId, activityDate: between(start, end) },
        include: { project: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.milestone.findMany({
        where: {
          completionAwardedAt: between(start, end),
          project: { userId },
        },
        include: { project: { select: { title: true } } },
        orderBy: { completionAwardedAt: "desc" },
      }),
      prisma.project.findMany({
        where: { userId, completionAwardedAt: between(start, end) },
        orderBy: { completionAwardedAt: "desc" },
      }),
      prisma.challengeResult.findMany({
        where: { userId, weekStart: between(start, end) },
        orderBy: { weekStart: "desc" },
      }),
    ]);

    const revision = practice.filter((item) => item.type === "DSA_Revision");
    const learning = practice.filter((item) => item.type === "Concept_Explanation");

    const sections: DayActivitySection[] = [
      {
        key: "dsa",
        title: "DSA Problems",
        items: dsa.map((item) => ({
          id: item.id,
          title: item.problemName,
          description: item.notes,
          metadata: [item.difficulty, `${item.timeTaken} min`, item.timeComplexity || "Complexity not recorded"],
          occurredAt: item.createdAt,
          link: item.url,
        })),
      },
      {
        key: "revision",
        title: "Revision",
        items: revision.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.notes,
          metadata: [`${item.timeSpent} min`, "Revision"],
          occurredAt: item.createdAt,
          link: item.proofLink,
        })),
      },
      {
        key: "learning",
        title: "Learning",
        items: learning.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.notes,
          metadata: [`${item.timeSpent} min`, "Concept explanation"],
          occurredAt: item.createdAt,
          link: item.proofLink,
        })),
      },
      {
        key: "fullstack",
        title: "Fullstack Activity",
        items: fullstack.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          metadata: [item.category.replace(/_/g, " "), item.type, `${item.timeSpent} min`],
          occurredAt: item.createdAt,
          link: item.proofLink,
        })),
      },
      {
        key: "projectWork",
        title: "Project Work Sessions",
        items: projectWork.map((item) => ({
          id: item.id,
          title: item.project.title,
          description: item.description,
          metadata: [`${item.timeSpent} min`, "Work session"],
          occurredAt: item.createdAt,
          link: item.proofLink,
        })),
      },
      {
        key: "milestones",
        title: "Milestones",
        items: milestones.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          metadata: [item.project.title, "Milestone completed"],
          occurredAt: item.completionAwardedAt || item.updatedAt,
        })),
      },
      {
        key: "projectCompletions",
        title: "Project Completions",
        items: completedProjects.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          metadata: [item.domain, "Project completed"],
          occurredAt: item.completionAwardedAt || item.updatedAt,
        })),
      },
      {
        key: "challenges",
        title: "Tournaments",
        items: challenges.map((item) => ({
          id: item.id,
          title: "Tournament result",
          metadata: [`${item.score} points`, `${item.problemsSolved} solved`, item.rank ? `Rank #${item.rank}` : "Rank pending"],
          occurredAt: item.weekStart,
          link: item.submissionLink,
        })),
      },
    ];

    return {
      date: dateKey,
      totalActivities: sections.reduce((total, section) => total + section.items.length, 0),
      totalPoints: scoreEvents.reduce((total, event) => total + event.points, 0),
      sections,
    };
  },
};
