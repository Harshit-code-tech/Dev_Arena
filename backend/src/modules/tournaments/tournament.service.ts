import { randomBytes } from "node:crypto";
import { Prisma, TournamentStatus, TournamentSubmissionStatus, TournamentType } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { githubService, type TournamentRepositorySnapshot } from "../github/github.service";
import { publishRealtimeEvent } from "../realtime/realtime.service";
import type {
  DsaTournamentSubmissionInput,
  ProjectTournamentSubmissionInput,
  TournamentListTab,
  TournamentRegistrationInput,
} from "./tournament.types";

function tournamentError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function clean(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function effectiveStatus(tournament: {
  status: TournamentStatus;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  startsAt: Date;
  endsAt: Date;
}) {
  if (tournament.status === "Draft" || tournament.status === "Cancelled" || tournament.status === "Completed") {
    return tournament.status;
  }
  const now = Date.now();
  if (now >= tournament.endsAt.getTime()) return "Judging" as const;
  if (now >= tournament.startsAt.getTime()) return "Live" as const;
  if (now >= tournament.registrationOpensAt.getTime() && now <= tournament.registrationClosesAt.getTime()) {
    return "Registration_Open" as const;
  }
  return "Published" as const;
}

function publicQuestion(question: {
  id: string;
  title: string;
  slug: string;
  statement: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  examples: Prisma.JsonValue | null;
  visibleTestCases: Prisma.JsonValue | null;
  difficulty: string;
  points: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages: string[];
  orderIndex: number;
}) {
  return {
    id: question.id,
    title: question.title,
    slug: question.slug,
    statement: question.statement,
    inputFormat: question.inputFormat,
    outputFormat: question.outputFormat,
    constraints: question.constraints,
    examples: question.examples,
    visibleTestCases: question.visibleTestCases,
    difficulty: question.difficulty,
    points: question.points,
    timeLimitMs: question.timeLimitMs,
    memoryLimitMb: question.memoryLimitMb,
    allowedLanguages: question.allowedLanguages,
    orderIndex: question.orderIndex,
  };
}

function stackItems(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [] as Array<{ name: string; percentage: number }>;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const name = clean(record.name, 50);
    const percentage = Number(record.percentage);
    return name && Number.isFinite(percentage) ? [{ name, percentage }] : [];
  });
}

const ROLE_LANGUAGES: Record<string, string[]> = {
  Frontend: ["TypeScript", "JavaScript", "CSS", "HTML", "Vue", "Svelte"],
  Backend: ["Python", "Java", "Go", "PHP", "Ruby", "C#", "TypeScript", "JavaScript"],
  Mobile: ["Kotlin", "Java", "Swift", "Dart", "TypeScript", "JavaScript"],
  "AI/ML": ["Python", "R", "Julia", "C++", "CUDA"],
  Systems: ["C", "C++", "Rust", "Go", "Assembly"],
};

function roleVector(stack: Array<{ name: string; percentage: number }>) {
  const values = Object.fromEntries(Object.keys(ROLE_LANGUAGES).map((role) => [role, 0])) as Record<string, number>;
  for (const item of stack) {
    for (const [role, languages] of Object.entries(ROLE_LANGUAGES)) {
      if (languages.some((language) => language.toLowerCase() === item.name.toLowerCase())) values[role] += item.percentage;
    }
  }
  return values;
}

function teamCompatibility(
  candidate: Array<{ name: string; percentage: number }>,
  members: Array<Array<{ name: string; percentage: number }>>,
) {
  if (!members.length) return 100;
  const candidateRoles = roleVector(candidate);
  const teamRoles = Object.fromEntries(Object.keys(ROLE_LANGUAGES).map((role) => [role, 0])) as Record<string, number>;
  for (const member of members) {
    const roles = roleVector(member);
    for (const role of Object.keys(teamRoles)) teamRoles[role] = Math.max(teamRoles[role], roles[role] || 0);
  }
  const gapCoverage = Object.keys(teamRoles).reduce((sum, role) => {
    const gap = Math.max(0, 100 - teamRoles[role]);
    return sum + Math.min(gap, candidateRoles[role] || 0);
  }, 0) / Object.keys(teamRoles).length;
  const candidateLanguages = new Set(candidate.map((item) => item.name.toLowerCase()));
  const teamLanguages = new Set(members.flat().map((item) => item.name.toLowerCase()));
  const unique = [...candidateLanguages].filter((language) => !teamLanguages.has(language)).length;
  const diversity = candidateLanguages.size ? (unique / candidateLanguages.size) * 100 : 30;
  return Number((gapCoverage * 0.72 + diversity * 0.28).toFixed(2));
}

async function collectTeamContributionEvidence(
  teamId: string | null,
  repositoryUrl: string,
  requestingUserId: string,
  requestingSnapshot: TournamentRepositorySnapshot,
) {
  if (!teamId) return Prisma.JsonNull;
  const members = await prisma.tournamentTeamMember.findMany({
    where: { teamId },
    select: { userId: true, role: true, user: { select: { username: true } } },
  });
  const evidence = await Promise.all(members.map(async (member) => {
    if (member.userId === requestingUserId) {
      return { userId: member.userId, username: member.user.username, role: member.role, contributionWeight: requestingSnapshot.contributionWeight, contributionStatus: requestingSnapshot.contributionStatus, verified: requestingSnapshot.eligible };
    }
    try {
      const snapshot = await githubService.getTournamentRepositorySnapshot(member.userId, repositoryUrl);
      return { userId: member.userId, username: member.user.username, role: member.role, contributionWeight: snapshot.contributionWeight, contributionStatus: snapshot.contributionStatus, verified: snapshot.eligible };
    } catch {
      return { userId: member.userId, username: member.user.username, role: member.role, contributionWeight: 0, contributionStatus: "UNVERIFIED_TEAM_MEMBER", verified: false };
    }
  }));
  return evidence as Prisma.InputJsonValue;
}

function projectAutomatedScore(input: {
  baselineSourceBytes: number;
  finalSourceBytes: number;
  baselineSizeKb: number;
  finalSizeKb: number;
  contributionWeight: number;
  deploymentUrl: string | null;
  eligible: boolean;
}) {
  if (!input.eligible) return 0;
  const sourceGrowth = Math.max(0, input.finalSourceBytes - input.baselineSourceBytes);
  const storageGrowth = Math.max(0, input.finalSizeKb - input.baselineSizeKb);
  const sourceScore = Math.min(30, Math.log10(sourceGrowth + 1) * 5.2);
  const storageSignal = Math.min(5, Math.log10(storageGrowth + 1) * 1.3);
  const contributionScore = Math.min(20, Math.max(0, input.contributionWeight) * 20);
  const deploymentScore = input.deploymentUrl ? 10 : 0;
  const developmentScore = sourceGrowth > 0 ? 10 : 0;
  return Number(Math.min(75, sourceScore + storageSignal + contributionScore + deploymentScore + developmentScore).toFixed(2));
}

async function refreshRegistrationScore(tournamentId: string, userId: string) {
  const submissions = await prisma.dsaTournamentSubmission.findMany({
    where: { tournamentId, userId },
    select: { questionId: true, score: true, penaltyMinutes: true, status: true },
  });
  const best = new Map<string, { score: number; penalty: number }>();
  for (const submission of submissions) {
    const current = best.get(submission.questionId);
    if (!current || submission.score > current.score || (submission.score === current.score && submission.penaltyMinutes < current.penalty)) {
      best.set(submission.questionId, { score: submission.score, penalty: submission.penaltyMinutes });
    }
  }
  const finalScore = [...best.values()].reduce((sum, item) => sum + item.score, 0);
  await prisma.tournamentRegistration.update({
    where: { tournamentId_userId: { tournamentId, userId } },
    data: { finalScore },
  });
}

async function ensureRegistered(userId: string, tournamentId: string) {
  const registration = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    include: { team: { include: { members: true } } },
  });
  if (!registration || registration.status === "Withdrawn" || registration.status === "Disqualified") {
    throw tournamentError("Register for this tournament before submitting work.", 403);
  }
  return registration;
}

async function findOrCreateAutoTeam(tournament: {
  id: string;
  title: string;
  teamSizeMin: number;
  teamSizeMax: number;
}, userId: string, preferredRole: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { topTechStack: true, topTechStackProjectCount: true, githubConnection: { select: { id: true } } } });
  const candidateStack = stackItems(user?.topTechStack);
  if (!user?.githubConnection || user.topTechStackProjectCount < 2 || candidateStack.length === 0) {
    throw tournamentError("Automatic team matching unlocks after GitHub is connected and at least two eligible projects build your live Tech Stack.", 409);
  }
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: tournament.id, status: { in: ["Forming", "Ready"] } },
    include: { members: { include: { user: { select: { topTechStack: true } } } } },
    take: 30,
  });
  const blocked = await prisma.playerBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set(blocked.flatMap((item) => [item.blockerId, item.blockedId]).filter((id) => id !== userId));
  const candidates = teams
    .filter((team) => team.members.length < tournament.teamSizeMax && team.members.every((member) => !blockedIds.has(member.userId)))
    .map((team) => ({
      team,
      score: teamCompatibility(candidateStack, team.members.map((member) => stackItems(member.user.topTechStack))),
    }))
    .sort((left, right) => right.score - left.score);

  const selected = candidates[0];
  if (selected && selected.score >= 35) {
    await prisma.tournamentTeamMember.create({ data: { teamId: selected.team.id, userId, role: preferredRole } });
    const memberCount = selected.team.members.length + 1;
    await prisma.tournamentTeam.update({
      where: { id: selected.team.id },
      data: { matchingScore: selected.score, status: memberCount >= tournament.teamSizeMin ? "Ready" : "Forming" },
    });
    return selected.team.id;
  }

  const joinCode = randomBytes(4).toString("hex").toUpperCase();
  const team = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      name: `${tournament.title.slice(0, 24)} Team`,
      joinCode,
      members: { create: { userId, role: preferredRole } },
    },
  });
  return team.id;
}

async function maybeRunExternalJudge(submissionId: string) {
  const judgeUrl = process.env.TOURNAMENT_JUDGE_URL?.trim();
  if (!judgeUrl) return;
  const submission = await prisma.dsaTournamentSubmission.findUnique({
    where: { id: submissionId },
    include: { question: true },
  });
  if (!submission) return;
  await prisma.dsaTournamentSubmission.update({ where: { id: submissionId }, data: { status: "Running" } });
  try {
    const response = await fetch(judgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.TOURNAMENT_JUDGE_SECRET ? { Authorization: `Bearer ${process.env.TOURNAMENT_JUDGE_SECRET}` } : {}),
      },
      body: JSON.stringify({
        submissionId,
        language: submission.language,
        code: submission.code,
        timeLimitMs: submission.question.timeLimitMs,
        memoryLimitMb: submission.question.memoryLimitMb,
        testCases: submission.question.hiddenTestCases,
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      status?: TournamentSubmissionStatus;
      passedTests?: number;
      totalTests?: number;
      executionTimeMs?: number;
      memoryUsedKb?: number;
      output?: string;
    };
    if (!response.ok) throw new Error("Judge request failed");
    const judgeStatuses: TournamentSubmissionStatus[] = ["Accepted", "Wrong_Answer", "Time_Limit_Exceeded", "Memory_Limit_Exceeded", "Runtime_Error", "Compilation_Error", "Under_Review"];
    const status = result.status && judgeStatuses.includes(result.status) ? result.status : "Under_Review";
    const accepted = status === "Accepted";
    await prisma.dsaTournamentSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        passedTests: Math.max(0, Number(result.passedTests) || 0),
        totalTests: Math.max(0, Number(result.totalTests) || 0),
        executionTimeMs: Number.isFinite(result.executionTimeMs) ? Number(result.executionTimeMs) : null,
        memoryUsedKb: Number.isFinite(result.memoryUsedKb) ? Number(result.memoryUsedKb) : null,
        judgeOutput: clean(result.output, 8000) || null,
        score: accepted ? submission.question.points : 0,
      },
    });
    await refreshRegistrationScore(submission.tournamentId, submission.userId);
  } catch (reason) {
    await prisma.dsaTournamentSubmission.update({
      where: { id: submissionId },
      data: { status: "Under_Review", judgeOutput: reason instanceof Error ? reason.message : "External judge unavailable" },
    });
  }
}

async function getTournamentLeaderboard(userId: string, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.status === "Draft") throw tournamentError("Tournament not found.", 404);
    const freezeActive = Boolean(
      tournament.leaderboardFreezesAt
      && tournament.leaderboardFreezesAt.getTime() <= Date.now()
      && !tournament.resultsPublishedAt
      && tournament.status !== "Completed",
    );
    if (freezeActive && Array.isArray(tournament.frozenLeaderboard)) {
      return tournament.frozenLeaderboard;
    }
    if (tournament.type === "Project") {
      const submissions = await prisma.projectTournamentSubmission.findMany({
        where: { tournamentId, status: { in: ["Submitted", "Under_Review", "Scored", "Accepted"] } },
        orderBy: [{ finalScore: "desc" }, { submittedAt: "asc" }],
        include: {
          user: { select: { id: true, name: true, username: true, avatarUrl: true, rank: true } },
          team: { include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, rank: true } } } } } },
        },
      });
      const rows = submissions.map((submission, index) => ({
        rank: index + 1,
        score: submission.finalScore,
        submission: {
          id: submission.id,
          status: submission.status,
          finalScore: submission.finalScore,
          automatedScore: submission.automatedScore,
          manualScore: submission.manualScore,
          submittedAt: submission.submittedAt,
          deploymentUrl: submission.deploymentUrl,
          repositoryPrivate: submission.repositoryPrivate,
          repositoryUrl: submission.repositoryPrivate ? null : submission.repositoryUrl,
          repositoryFullName: submission.repositoryPrivate ? "Private repository" : submission.repositoryFullName,
          user: submission.user,
          team: submission.team,
        },
      }));
      if (freezeActive) {
        await prisma.tournament.update({ where: { id: tournamentId }, data: { frozenLeaderboard: jsonSafe(rows), leaderboardFrozenAt: new Date() } });
      }
      return rows;
    }
    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId, status: { notIn: ["Withdrawn", "Disqualified"] } },
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, rank: true } } },
    });
    const submissions = await prisma.dsaTournamentSubmission.findMany({ where: { tournamentId } });
    const rows = registrations.map((registration) => {
      const mine = submissions.filter((submission) => submission.userId === registration.userId);
      const best = new Map<string, typeof mine[number]>();
      for (const submission of mine) {
        const current = best.get(submission.questionId);
        if (!current || submission.score > current.score || (submission.score === current.score && submission.penaltyMinutes < current.penaltyMinutes)) best.set(submission.questionId, submission);
      }
      const selected = [...best.values()];
      return {
        user: registration.user,
        score: selected.reduce((sum, item) => sum + item.score, 0),
        solved: selected.filter((item) => item.status === "Accepted").length,
        penalty: selected.reduce((sum, item) => sum + item.penaltyMinutes, 0),
      };
    }).sort((left, right) => right.score - left.score || right.solved - left.solved || left.penalty - right.penalty);
    const ranked = rows.map((row, index) => ({ rank: index + 1, ...row, isCurrentUser: row.user.id === userId }));
    if (freezeActive) {
      await prisma.tournament.update({ where: { id: tournamentId }, data: { frozenLeaderboard: jsonSafe(ranked), leaderboardFrozenAt: new Date() } });
    }
    return ranked;
}

export const tournamentService = {
  async runScheduledMaintenance() {
    const due = await prisma.tournament.findMany({
      where: {
        leaderboardFreezesAt: { lte: new Date() },
        leaderboardFrozenAt: null,
        resultsPublishedAt: null,
        status: { notIn: ["Draft", "Cancelled", "Completed"] },
      },
      select: { id: true },
      take: 20,
    });
    for (const tournament of due) {
      await getTournamentLeaderboard("", tournament.id).catch(() => undefined);
    }
    return { frozen: due.length };
  },

  async globalLeaderboard(userId: string) {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { not: "Draft" } },
      orderBy: [{ startsAt: "desc" }],
      take: 25,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        startsAt: true,
        endsAt: true,
        resultsPublishedAt: true,
        leaderboardFreezesAt: true,
        frozenLeaderboard: true,
        registrations: {
          where: { status: { notIn: ["Withdrawn", "Disqualified"] } },
          orderBy: [{ finalRank: "asc" }, { finalScore: "desc" }, { registeredAt: "asc" }],
          take: 10,
          select: {
            userId: true,
            finalScore: true,
            finalRank: true,
            arenaPointsAwarded: true,
            participationMode: true,
            team: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, username: true, avatarUrl: true, rank: true, topTechStack: true } },
          },
        },
      },
    });
    return tournaments.map((tournament) => {
      const freezeActive = Boolean(tournament.leaderboardFreezesAt && tournament.leaderboardFreezesAt.getTime() <= Date.now() && !tournament.resultsPublishedAt && tournament.status !== "Completed");
      const rows = freezeActive && Array.isArray(tournament.frozenLeaderboard)
        ? tournament.frozenLeaderboard
        : tournament.registrations.map((registration, index) => ({
            rank: registration.finalRank || index + 1,
            score: registration.finalScore,
            arenaPointsAwarded: registration.arenaPointsAwarded,
            participationMode: registration.participationMode,
            team: registration.team,
            user: registration.user,
            isCurrentUser: registration.userId === userId,
          }));
      return {
        ...tournament,
        effectiveStatus: effectiveStatus({
          status: tournament.status,
          registrationOpensAt: tournament.startsAt,
          registrationClosesAt: tournament.startsAt,
          startsAt: tournament.startsAt,
          endsAt: tournament.endsAt,
        }),
        leaderboardFrozen: freezeActive,
        rows,
        registrations: undefined,
        frozenLeaderboard: undefined,
      };
    });
  },
  async list(userId: string, tab: TournamentListTab | string = "Upcoming") {
    const registrations = await prisma.tournamentRegistration.findMany({ where: { userId }, select: { tournamentId: true } });
    const registeredIds = registrations.map((item) => item.tournamentId);
    const now = new Date();
    const where: Prisma.TournamentWhereInput = tab === "Live"
      ? { status: { notIn: ["Draft", "Cancelled"] }, startsAt: { lte: now }, endsAt: { gte: now } }
      : tab === "Completed"
        ? { OR: [{ status: "Completed" }, { endsAt: { lt: now } }], status: { not: "Draft" } }
        : tab === "My Tournaments"
          ? { id: { in: registeredIds } }
          : { status: { notIn: ["Draft", "Cancelled", "Completed"] }, startsAt: { gt: now } };
    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: [{ startsAt: "asc" }],
      include: {
        _count: { select: { registrations: true, teams: true, questions: true } },
        registrations: { where: { userId }, take: 1, include: { team: { include: { members: { include: { user: { select: { id: true, name: true, username: true, topTechStack: true } } } } } } } },
      },
      take: 100,
    });
    return tournaments.map((tournament) => ({
      ...tournament,
      effectiveStatus: effectiveStatus(tournament),
      registration: tournament.registrations[0] || null,
      registrations: undefined,
    }));
  },

  async detail(userId: string, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        questions: { where: { status: "Published" }, orderBy: { orderIndex: "asc" } },
        announcements: { orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true, username: true } } } },
        registrations: { where: { userId }, include: { team: { include: { members: { include: { user: { select: { id: true, name: true, username: true, topTechStack: true } } } } } } } },
        _count: { select: { registrations: true, teams: true, questions: true } },
      },
    });
    if (!tournament || tournament.status === "Draft") throw tournamentError("Tournament not found.", 404);
    const status = effectiveStatus(tournament);
    const registration = tournament.registrations[0] || null;
    const canViewQuestions = tournament.type === "DSA" && Boolean(registration) && (status === "Live" || status === "Judging" || status === "Completed");
    const projectSubmission = tournament.type === "Project" && registration
      ? await prisma.projectTournamentSubmission.findFirst({
          where: registration.teamId
            ? { tournamentId, teamId: registration.teamId }
            : { tournamentId, userId },
          select: {
            id: true, repositoryUrl: true, repositoryPrivate: true, deploymentUrl: true, demoVideoUrl: true, notes: true,
            status: true, automatedScore: true, manualScore: true, finalScore: true, baselineCommitSha: true, finalCommitSha: true,
            baselineSourceBytes: true, finalSourceBytes: true, baselineCapturedAt: true, submittedAt: true, lastGithubRefreshAt: true,
          },
        })
      : null;
    return {
      ...tournament,
      effectiveStatus: status,
      registration,
      projectSubmission,
      registrations: undefined,
      questions: canViewQuestions ? tournament.questions.map(publicQuestion) : [],
    };
  },

  async register(userId: string, tournamentId: string, input: TournamentRegistrationInput) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.status === "Draft" || tournament.status === "Cancelled") throw tournamentError("Tournament not found.", 404);
    const now = Date.now();
    if (now < tournament.registrationOpensAt.getTime() || now > tournament.registrationClosesAt.getTime()) {
      throw tournamentError("Tournament registration is not open.", 409);
    }
    if (tournament.maxParticipants) {
      const count = await prisma.tournamentRegistration.count({ where: { tournamentId, status: { not: "Withdrawn" } } });
      if (count >= tournament.maxParticipants) throw tournamentError("This tournament has reached its participant limit.", 409);
    }
    if (await prisma.tournamentRegistration.findUnique({ where: { tournamentId_userId: { tournamentId, userId } } })) {
      throw tournamentError("You are already registered for this tournament.", 409);
    }

    const requested = input.participationMode || "Solo";
    if (tournament.type === "DSA" && requested !== "Solo") throw tournamentError("DSA tournaments are solo only.");
    if (tournament.type === "Project" && tournament.mode === "Solo" && requested !== "Solo") throw tournamentError("This project tournament is solo only.");
    if (tournament.type === "Project" && tournament.mode === "Team" && requested === "Solo") throw tournamentError("This project tournament requires a team.");

    let teamId: string | null = null;
    if (requested === "Auto Team") {
      teamId = await findOrCreateAutoTeam(tournament, userId, clean(input.preferredRole, 60) || null);
    } else if (requested === "Existing Team") {
      const teamCode = clean(input.teamCode, 40).toUpperCase();
      const team = await prisma.tournamentTeam.findUnique({ where: { joinCode: teamCode }, include: { _count: { select: { members: true } } } });
      if (!team || team.tournamentId !== tournamentId) throw tournamentError("Team code is invalid.", 404);
      if (team._count.members >= tournament.teamSizeMax) throw tournamentError("This team is already full.", 409);
      await prisma.tournamentTeamMember.create({ data: { teamId: team.id, userId, role: clean(input.preferredRole, 60) || null } });
      const memberCount = team._count.members + 1;
      await prisma.tournamentTeam.update({ where: { id: team.id }, data: { status: memberCount >= tournament.teamSizeMin ? "Ready" : "Forming" } });
      teamId = team.id;
    }

    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId,
        userId,
        participationMode: requested,
        teamId,
        status: teamId ? "Matched" : "Registered",
        preferredRole: clean(input.preferredRole, 60) || null,
        availability: clean(input.availability, 80) || null,
      },
      include: { team: { include: { members: { include: { user: { select: { id: true, name: true, username: true, topTechStack: true } } } } } } },
    });
    await publishRealtimeEvent({ userId, type: "tournaments.registration.changed", entityType: "Tournament", entityId: tournamentId, payload: { registrationId: registration.id } });
    return registration;
  },

  async submitDsa(userId: string, tournamentId: string, input: DsaTournamentSubmissionInput) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.type !== "DSA") throw tournamentError("DSA tournament not found.", 404);
    if (effectiveStatus(tournament) !== "Live") throw tournamentError("DSA submissions are accepted only while the tournament is live.", 409);
    await ensureRegistered(userId, tournamentId);
    const questionId = clean(input.questionId, 80);
    const question = await prisma.tournamentQuestion.findFirst({ where: { id: questionId, tournamentId, status: "Published" } });
    if (!question) throw tournamentError("Question not found.", 404);
    const language = clean(input.language, 40);
    const code = String(input.code || "").trim();
    if (!question.allowedLanguages.includes(language)) throw tournamentError("Choose one of the allowed programming languages.");
    if (code.length < 10 || code.length > 100_000) throw tournamentError("Submission code must contain 10 to 100,000 characters.");
    const previousWrong = await prisma.dsaTournamentSubmission.count({
      where: { tournamentId, questionId, userId, status: { in: ["Wrong_Answer", "Runtime_Error", "Time_Limit_Exceeded", "Memory_Limit_Exceeded", "Compilation_Error"] } },
    });
    const submission = await prisma.dsaTournamentSubmission.create({
      data: {
        tournamentId,
        questionId,
        userId,
        language,
        code,
        status: process.env.TOURNAMENT_JUDGE_URL ? "Queued" : "Under_Review",
        totalTests: Array.isArray(question.hiddenTestCases) ? question.hiddenTestCases.length : 0,
        penaltyMinutes: previousWrong * 5,
      },
    });
    void maybeRunExternalJudge(submission.id);
    return submission;
  },

  async saveProjectSubmission(userId: string, tournamentId: string, input: ProjectTournamentSubmissionInput) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.type !== "Project") throw tournamentError("Project tournament not found.", 404);
    const registration = await ensureRegistered(userId, tournamentId);
    if (input.finalize && registration.teamId) {
      const memberCount = await prisma.tournamentTeamMember.count({ where: { teamId: registration.teamId } });
      if (memberCount < tournament.teamSizeMin || memberCount > tournament.teamSizeMax) {
        throw tournamentError(`Final team submissions require ${tournament.teamSizeMin}–${tournament.teamSizeMax} members.`, 409);
      }
    }
    const repositoryUrl = clean(input.repositoryUrl, 500);
    if (!repositoryUrl) throw tournamentError("Connect the GitHub repository used for this tournament.");
    const snapshot = await githubService.getTournamentRepositorySnapshot(userId, repositoryUrl);
    if (!snapshot.eligible) throw tournamentError("This repository needs verified original or substantial collaborative work before it can be submitted.", 409);
    const existing = await prisma.projectTournamentSubmission.findFirst({
      where: registration.teamId ? { tournamentId, teamId: registration.teamId } : { tournamentId, userId },
    });
    const deploymentUrl = clean(input.deploymentUrl, 500) || null;
    if (input.finalize && tournament.requireDeployment && !deploymentUrl) throw tournamentError("A deployment URL is required for final submission.");
    if (input.finalize && Date.now() > tournament.endsAt.getTime() + 5 * 60_000) throw tournamentError("The project submission deadline has passed.", 409);

    const baselineSource = existing?.baselineSourceBytes ?? snapshot.sourceBytes;
    const baselineSize = existing?.baselineRepositorySizeKb ?? snapshot.repositorySizeKb;
    const automatedScore = projectAutomatedScore({
      baselineSourceBytes: baselineSource,
      finalSourceBytes: snapshot.sourceBytes,
      baselineSizeKb: baselineSize,
      finalSizeKb: snapshot.repositorySizeKb,
      contributionWeight: snapshot.contributionWeight,
      deploymentUrl,
      eligible: snapshot.eligible,
    });
    const status: TournamentSubmissionStatus = input.finalize ? "Under_Review" : "Draft";
    const memberContributionWeights = input.finalize
      ? await collectTeamContributionEvidence(registration.teamId, snapshot.url, userId, snapshot)
      : existing?.memberContributionWeights ?? Prisma.JsonNull;
    const data = {
      repositoryUrl: snapshot.url,
      repositoryId: snapshot.repositoryId,
      repositoryFullName: snapshot.fullName,
      repositoryPrivate: snapshot.isPrivate,
      baselineCommitSha: existing?.baselineCommitSha || snapshot.headSha,
      finalCommitSha: input.finalize ? snapshot.headSha : existing?.finalCommitSha || null,
      baselineSourceBytes: baselineSource,
      finalSourceBytes: snapshot.sourceBytes,
      baselineRepositorySizeKb: baselineSize,
      finalRepositorySizeKb: snapshot.repositorySizeKb,
      languageBytes: snapshot.languageBytes,
      languages: snapshot.languages,
      contributionWeight: snapshot.contributionWeight,
      contributionStatus: snapshot.contributionStatus,
      memberContributionWeights,
      deploymentUrl,
      demoVideoUrl: clean(input.demoVideoUrl, 500) || null,
      notes: clean(input.notes, 8000) || null,
      status,
      automatedScore,
      finalScore: Number((automatedScore + (existing?.manualScore || 0)).toFixed(2)),
      baselineCapturedAt: existing?.baselineCapturedAt || new Date(),
      submittedAt: input.finalize ? new Date() : existing?.submittedAt || null,
      lastGithubRefreshAt: snapshot.verifiedAt,
    } satisfies Prisma.ProjectTournamentSubmissionUncheckedUpdateInput;

    const submission = existing
      ? await prisma.projectTournamentSubmission.update({ where: { id: existing.id }, data })
      : await prisma.projectTournamentSubmission.create({
          data: { ...data, tournamentId, userId, teamId: registration.teamId },
        });
    await prisma.tournamentRegistration.update({
      where: { tournamentId_userId: { tournamentId, userId } },
      data: { finalScore: submission.finalScore },
    });
    return submission;
  },

  async leaderboard(userId: string, tournamentId: string) {
    return getTournamentLeaderboard(userId, tournamentId);
  },
};
