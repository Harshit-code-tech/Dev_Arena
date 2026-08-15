import { randomBytes } from "node:crypto";
import { Difficulty, Prisma, TournamentStatus, TournamentSubmissionStatus, TournamentType } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { rebuildUserScoreState } from "../../shared/services/scoring.service";
import { publishRealtimeEvents } from "../realtime/realtime.service";

function adminError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function clean(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

function dateValue(value: unknown, label: string) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) throw adminError(`${label} is invalid.`);
  return date;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || randomBytes(5).toString("hex");
}

function jsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null || value === "") return Prisma.JsonNull;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      throw adminError("Test cases and examples must be valid JSON.");
    }
  }
  return value as Prisma.InputJsonValue;
}

async function audit(actorId: string, action: string, entityType: string, entityId: string | null, after?: Prisma.InputJsonValue, reason?: string) {
  await prisma.adminAuditLog.create({
    data: { actorId, action, entityType, entityId, ...(after ? { after } : {}), reason: reason || null },
  });
}

function tournamentInput(input: Record<string, unknown>) {
  const title = clean(input.title, 120);
  const description = clean(input.description, 12_000);
  const rules = clean(input.rules, 12_000);
  if (!title || !description || !rules) throw adminError("Tournament title, description, and rules are required.");
  const type = clean(input.type, 20) as TournamentType;
  if (!(["DSA", "Project"] as string[]).includes(type)) throw adminError("Tournament type must be DSA or Project.");
  const mode = clean(input.mode, 20) || "Solo";
  if (!(["Solo", "Team", "Both"] as string[]).includes(mode)) throw adminError("Tournament mode is invalid.");
  if (type === "DSA" && mode !== "Solo") throw adminError("DSA tournaments must be solo.");
  const registrationOpensAt = dateValue(input.registrationOpensAt, "Registration opening time");
  const registrationClosesAt = dateValue(input.registrationClosesAt, "Registration closing time");
  const startsAt = dateValue(input.startsAt, "Start time");
  const endsAt = dateValue(input.endsAt, "End time");
  if (!(registrationOpensAt < registrationClosesAt && registrationClosesAt <= startsAt && startsAt < endsAt)) {
    throw adminError("Dates must follow: registration opens, registration closes, tournament starts, tournament ends.");
  }
  const leaderboardFreezesAt = input.leaderboardFreezesAt ? dateValue(input.leaderboardFreezesAt, "Leaderboard freeze time") : null;
  if (leaderboardFreezesAt && (leaderboardFreezesAt < startsAt || leaderboardFreezesAt > endsAt)) {
    throw adminError("Leaderboard freeze time must fall inside the tournament window.");
  }
  const teamSizeMin = type === "DSA" ? 1 : Math.max(1, Math.min(20, Number(input.teamSizeMin) || 1));
  const teamSizeMax = type === "DSA" ? 1 : Math.max(teamSizeMin, Math.min(20, Number(input.teamSizeMax) || teamSizeMin));
  const allowedLanguages = Array.isArray(input.allowedLanguages)
    ? input.allowedLanguages.map((item) => clean(item, 40)).filter(Boolean)
    : clean(input.allowedLanguages, 500).split(",").map((item) => item.trim()).filter(Boolean);
  const status = clean(input.status, 40) || "Draft";
  if (!( ["Draft", "Published", "Registration_Open", "Live", "Judging", "Completed", "Cancelled"] as string[]).includes(status)) {
    throw adminError("Tournament status is invalid.");
  }
  return {
    title,
    slug: clean(input.slug, 90) ? slugify(clean(input.slug, 90)) : slugify(title),
    description,
    rules,
    type,
    mode: mode as "Solo" | "Team" | "Both",
    status: status as TournamentStatus,
    difficulty: clean(input.difficulty, 30) || "Mixed",
    registrationOpensAt,
    registrationClosesAt,
    startsAt,
    endsAt,
    leaderboardFreezesAt,
    teamSizeMin,
    teamSizeMax,
    maxParticipants: input.maxParticipants ? Math.max(1, Number(input.maxParticipants)) : null,
    allowedLanguages,
    theme: clean(input.theme, 500) || null,
    requiredFeatures: clean(input.requiredFeatures, 12_000) || null,
    submissionChecklist: clean(input.submissionChecklist, 12_000) || null,
    requireDeployment: Boolean(input.requireDeployment),
    firstPlacePoints: Math.max(0, Number(input.firstPlacePoints) || 100),
    secondPlacePoints: Math.max(0, Number(input.secondPlacePoints) || 70),
    thirdPlacePoints: Math.max(0, Number(input.thirdPlacePoints) || 50),
    topTenPercentPoints: Math.max(0, Number(input.topTenPercentPoints) || 25),
    participationPoints: Math.max(0, Number(input.participationPoints) || 5),
  };
}

async function recalculateDsaRegistration(tournamentId: string, userId: string) {
  const submissions = await prisma.dsaTournamentSubmission.findMany({ where: { tournamentId, userId } });
  const best = new Map<string, typeof submissions[number]>();
  for (const submission of submissions) {
    const current = best.get(submission.questionId);
    if (!current || submission.score > current.score || (submission.score === current.score && submission.penaltyMinutes < current.penaltyMinutes)) best.set(submission.questionId, submission);
  }
  await prisma.tournamentRegistration.update({
    where: { tournamentId_userId: { tournamentId, userId } },
    data: { finalScore: [...best.values()].reduce((sum, item) => sum + item.score, 0) },
  });
}

function awardForRank(rank: number, total: number, tournament: {
  firstPlacePoints: number;
  secondPlacePoints: number;
  thirdPlacePoints: number;
  topTenPercentPoints: number;
  participationPoints: number;
}) {
  if (rank === 1) return tournament.firstPlacePoints;
  if (rank === 2) return tournament.secondPlacePoints;
  if (rank === 3) return tournament.thirdPlacePoints;
  if (rank <= Math.max(1, Math.ceil(total * 0.1))) return tournament.topTenPercentPoints;
  return tournament.participationPoints;
}

export const adminService = {
  async heartbeat(userId: string, input: Record<string, unknown>) {
    const sessionId = clean(input.sessionId, 100);
    const route = clean(input.route, 300) || null;
    if (!sessionId) throw adminError("Presence session is missing.");
    const now = new Date();
    await prisma.userPresence.upsert({
      where: { userId },
      create: { userId, sessionId, route, lastSeenAt: now },
      update: { sessionId, route, lastSeenAt: now },
    });
    const bucketAt = new Date(Math.floor(now.getTime() / 300_000) * 300_000);
    const cutoff = new Date(now.getTime() - 120_000);
    const onlineCount = await prisma.userPresence.count({ where: { lastSeenAt: { gte: cutoff } } });
    const globalSnapshot = await prisma.presenceSnapshot.findFirst({ where: { bucketAt, tournamentId: null }, select: { id: true } });
    if (globalSnapshot) await prisma.presenceSnapshot.update({ where: { id: globalSnapshot.id }, data: { onlineCount } });
    else await prisma.presenceSnapshot.create({ data: { bucketAt, onlineCount } });
    const tournamentMatch = route?.match(/\/tournaments\/([0-9a-f-]{20,})/i);
    if (tournamentMatch?.[1]) {
      const tournamentId = tournamentMatch[1];
      const tournamentOnline = await prisma.userPresence.count({ where: { route: { startsWith: `/tournaments/${tournamentId}` }, lastSeenAt: { gte: cutoff } } });
      await prisma.presenceSnapshot.upsert({
        where: { bucketAt_tournamentId: { bucketAt, tournamentId } },
        create: { bucketAt, onlineCount: tournamentOnline, tournamentId },
        update: { onlineCount: tournamentOnline },
      }).catch(() => undefined);
    }
    return { online: true, at: now };
  },

  async access(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
    const envAdmins = new Set(String(process.env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
    return { allowed: Boolean(user && (user.role === "Admin" || user.role === "Judge" || envAdmins.has(user.email.toLowerCase()))), role: user?.role || "User" };
  },

  async overview() {
    const started = Date.now();
    const now = new Date();
    const onlineCutoff = new Date(now.getTime() - 120_000);
    const fiveMinutes = new Date(now.getTime() - 300_000);
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const [onlineUsers, activeFive, activeToday, totalUsers, newUsersToday, liveTournaments, upcomingTournaments, pendingDsa, pendingProjects, githubFailures, openFeedback, openReports] = await Promise.all([
      prisma.userPresence.findMany({ where: { lastSeenAt: { gte: onlineCutoff } }, include: { user: { select: { id: true, name: true, username: true, email: true } } }, orderBy: { lastSeenAt: "desc" } }),
      prisma.userPresence.count({ where: { lastSeenAt: { gte: fiveMinutes } } }),
      prisma.userPresence.count({ where: { lastSeenAt: { gte: dayStart } } }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
      prisma.tournament.count({ where: { startsAt: { lte: now }, endsAt: { gte: now }, status: { notIn: ["Draft", "Cancelled"] } } }),
      prisma.tournament.count({ where: { startsAt: { gt: now }, status: { notIn: ["Draft", "Cancelled", "Completed"] } } }),
      prisma.dsaTournamentSubmission.count({ where: { status: { in: ["Queued", "Running", "Under_Review"] } } }),
      prisma.projectTournamentSubmission.count({ where: { status: { in: ["Submitted", "Under_Review"] } } }),
      prisma.gitHubWebhookDelivery.count({ where: { status: { in: ["Failed", "Rejected"] } } }),
      prisma.feedbackSubmission.count({ where: { status: { in: ["Open", "Under Review"] } } }),
      prisma.playerReport.count({ where: { status: "Open" } }),
    ]);
    const byRoute = Object.entries(onlineUsers.reduce<Record<string, number>>((acc, item) => {
      const route = item.route || "Unknown";
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {})).sort((left, right) => right[1] - left[1]);
    return {
      metrics: { onlineNow: onlineUsers.length, activeLastFiveMinutes: activeFive, activeToday, totalUsers, newUsersToday, liveTournaments, upcomingTournaments, pendingDsa, pendingProjects, githubFailures, openFeedback, openReports, databaseLatencyMs: Date.now() - started },
      onlineUsers,
      byRoute,
    };
  },

  async presenceHistory(hours = 24) {
    const safeHours = Math.max(1, Math.min(24 * 30, Math.round(hours)));
    return prisma.presenceSnapshot.findMany({
      where: { tournamentId: null, bucketAt: { gte: new Date(Date.now() - safeHours * 60 * 60 * 1000) } },
      orderBy: { bucketAt: "asc" },
    });
  },

  async metrics(hours = 24) {
    const safeHours = Math.max(1, Math.min(24 * 30, Math.round(hours)));
    const now = new Date();
    const start = new Date(now.getTime() - safeHours * 60 * 60 * 1000);
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const onlineCutoff = new Date(now.getTime() - 120_000);
    const fiveMinutes = new Date(now.getTime() - 300_000);
    const interval = safeHours <= 1
      ? Prisma.raw("INTERVAL '5 minutes'")
      : safeHours <= 24
        ? Prisma.raw("INTERVAL '1 hour'")
        : safeHours <= 168
          ? Prisma.raw("INTERVAL '6 hours'")
          : Prisma.raw("INTERVAL '1 day'");

    const started = Date.now();
    const [onlineNow, activeLastFiveMinutes, activeToday, totalUsers, newUsers, messages, projects, dsaLogs, tournamentRegistrations, githubConnectedUsers, githubFailures, refreshJobs, pendingJudging, openFeedback, realtimeEventsLastHour] = await Promise.all([
      prisma.userPresence.count({ where: { lastSeenAt: { gte: onlineCutoff } } }),
      prisma.userPresence.count({ where: { lastSeenAt: { gte: fiveMinutes } } }),
      prisma.userPresence.count({ where: { lastSeenAt: { gte: dayStart } } }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: start } } }),
      prisma.directMessage.count({ where: { createdAt: { gte: start } } }),
      prisma.project.count({ where: { createdAt: { gte: start } } }),
      prisma.dSALog.count({ where: { createdAt: { gte: start } } }),
      prisma.tournamentRegistration.count({ where: { registeredAt: { gte: start } } }),
      prisma.gitHubConnection.count({ where: { connectedAt: { not: null } } }),
      prisma.gitHubWebhookDelivery.count({ where: { receivedAt: { gte: start }, status: { in: ["Failed", "Rejected"] } } }),
      prisma.gitHubProjectRefreshJob.count(),
      Promise.all([
        prisma.dsaTournamentSubmission.count({ where: { status: { in: ["Queued", "Running", "Under_Review"] } } }),
        prisma.projectTournamentSubmission.count({ where: { status: { in: ["Submitted", "Under_Review"] } } }),
      ]).then(([dsa, project]) => dsa + project),
      prisma.feedbackSubmission.count({ where: { status: { in: ["Open", "Under Review"] } } }),
      prisma.realtimeEvent.count({ where: { createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } } }),
    ]);

    type MetricRow = {
      bucket_at: Date;
      active_users: number;
      new_users: number;
      messages: number;
      projects: number;
      dsa_logs: number;
      tournament_activity: number;
      github_events: number;
    };

    const rows = await prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      WITH buckets AS (
        SELECT generate_series(${start}::timestamptz, ${now}::timestamptz, ${interval}) AS bucket_at
      )
      SELECT
        b.bucket_at,
        COALESCE((
          SELECT MAX(ps.online_count)
          FROM presence_snapshots ps
          WHERE ps.tournament_id IS NULL
            AND ps.bucket_at >= b.bucket_at
            AND ps.bucket_at < b.bucket_at + ${interval}
        ), 0)::int AS active_users,
        (SELECT COUNT(*)::int FROM users u
          WHERE u.created_at >= b.bucket_at AND u.created_at < b.bucket_at + ${interval}) AS new_users,
        (SELECT COUNT(*)::int FROM direct_messages dm
          WHERE dm.created_at >= b.bucket_at AND dm.created_at < b.bucket_at + ${interval}) AS messages,
        (SELECT COUNT(*)::int FROM projects p
          WHERE p.created_at >= b.bucket_at AND p.created_at < b.bucket_at + ${interval}) AS projects,
        (SELECT COUNT(*)::int FROM dsa_logs d
          WHERE d.created_at >= b.bucket_at AND d.created_at < b.bucket_at + ${interval}) AS dsa_logs,
        (
          (SELECT COUNT(*)::int FROM tournament_registrations tr
            WHERE tr.registered_at >= b.bucket_at AND tr.registered_at < b.bucket_at + ${interval})
          +
          (SELECT COUNT(*)::int FROM dsa_tournament_submissions ds
            WHERE ds.submitted_at >= b.bucket_at AND ds.submitted_at < b.bucket_at + ${interval})
          +
          (SELECT COUNT(*)::int FROM project_tournament_submissions psu
            WHERE psu.submitted_at IS NOT NULL
              AND psu.submitted_at >= b.bucket_at AND psu.submitted_at < b.bucket_at + ${interval})
        )::int AS tournament_activity,
        (SELECT COUNT(*)::int FROM github_webhook_deliveries gh
          WHERE gh.received_at >= b.bucket_at AND gh.received_at < b.bucket_at + ${interval}) AS github_events
      FROM buckets b
      ORDER BY b.bucket_at ASC
    `);

    return {
      hours: safeHours,
      generatedAt: now,
      summary: {
        onlineNow,
        activeLastFiveMinutes,
        activeToday,
        totalUsers,
        newUsers,
        messages,
        projects,
        dsaLogs,
        tournamentRegistrations,
        githubConnectedUsers,
        githubFailures,
        refreshJobs,
        pendingJudging,
        openFeedback,
        realtimeEventsLastHour,
        databaseLatencyMs: Date.now() - started,
      },
      series: rows.map((row) => ({
        at: row.bucket_at,
        activeUsers: Number(row.active_users) || 0,
        newUsers: Number(row.new_users) || 0,
        messages: Number(row.messages) || 0,
        projects: Number(row.projects) || 0,
        dsaLogs: Number(row.dsa_logs) || 0,
        tournamentActivity: Number(row.tournament_activity) || 0,
        githubEvents: Number(row.github_events) || 0,
      })),
    };
  },

  async listTournaments() {
    return prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true, questions: true, teams: true, dsaSubmissions: true, projectSubmissions: true } } },
    });
  },

  async createTournament(actorId: string, input: Record<string, unknown>) {
    const tournament = await prisma.tournament.create({ data: tournamentInput(input) });
    await audit(actorId, "CREATE_TOURNAMENT", "Tournament", tournament.id, { title: tournament.title, status: tournament.status, type: tournament.type });
    return tournament;
  },

  async updateTournament(actorId: string, tournamentId: string, input: Record<string, unknown>) {
    const existing = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!existing) throw adminError("Tournament not found.", 404);
    const data = tournamentInput({ ...existing, ...input });
    const tournament = await prisma.tournament.update({ where: { id: tournamentId }, data });
    await audit(actorId, "UPDATE_TOURNAMENT", "Tournament", tournament.id, { title: tournament.title, status: tournament.status });
    return tournament;
  },

  async createQuestion(actorId: string, tournamentId: string, input: Record<string, unknown>) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.type !== "DSA") throw adminError("Choose a DSA tournament.", 404);
    const title = clean(input.title, 160);
    const statement = clean(input.statement, 30_000);
    if (!title || !statement) throw adminError("Question title and statement are required.");
    const difficulty = clean(input.difficulty, 20) as Difficulty;
    if (!(["Easy", "Medium", "Hard"] as string[]).includes(difficulty)) throw adminError("Question difficulty is invalid.");
    const allowedLanguages = Array.isArray(input.allowedLanguages) ? input.allowedLanguages.map((item) => clean(item, 40)).filter(Boolean) : clean(input.allowedLanguages, 400).split(",").map((item) => item.trim()).filter(Boolean);
    const question = await prisma.tournamentQuestion.create({
      data: {
        tournamentId,
        title,
        slug: slugify(clean(input.slug, 100) || title),
        statement,
        inputFormat: clean(input.inputFormat, 10_000) || null,
        outputFormat: clean(input.outputFormat, 10_000) || null,
        constraints: clean(input.constraints, 10_000) || null,
        examples: jsonValue(input.examples),
        visibleTestCases: jsonValue(input.visibleTestCases),
        hiddenTestCases: jsonValue(input.hiddenTestCases),
        officialSolution: clean(input.officialSolution, 100_000) || null,
        explanation: clean(input.explanation, 30_000) || null,
        difficulty,
        points: Math.max(1, Number(input.points) || (difficulty === "Easy" ? 100 : difficulty === "Medium" ? 300 : 700)),
        timeLimitMs: Math.max(100, Number(input.timeLimitMs) || 2000),
        memoryLimitMb: Math.max(16, Number(input.memoryLimitMb) || 256),
        allowedLanguages,
        orderIndex: Math.max(0, Number(input.orderIndex) || 0),
        status: clean(input.status, 30) || "Draft",
      },
    });
    const recipients = await prisma.tournamentRegistration.findMany({ where: { tournamentId, status: { not: "Withdrawn" } }, select: { userId: true } });
    await publishRealtimeEvents(recipients.map((item) => item.userId), { type: "tournaments.questions.changed", entityType: "Tournament", entityId: tournamentId, payload: { questionId: question.id } });
    await audit(actorId, "CREATE_QUESTION", "TournamentQuestion", question.id, { title: question.title, tournamentId });
    return question;
  },

  async listQuestions(tournamentId: string) {
    return prisma.tournamentQuestion.findMany({ where: { tournamentId }, orderBy: { orderIndex: "asc" } });
  },

  async listSubmissions(tournamentId?: string) {
    const where = tournamentId ? { tournamentId } : {};
    const [dsa, projects] = await Promise.all([
      prisma.dsaTournamentSubmission.findMany({ where, orderBy: { submittedAt: "desc" }, take: 200, include: { user: { select: { id: true, name: true, username: true } }, question: { select: { title: true, points: true } }, tournament: { select: { title: true } } } }),
      prisma.projectTournamentSubmission.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, name: true, username: true } }, team: { include: { members: { include: { user: { select: { id: true, name: true, username: true } } } } } }, tournament: { select: { title: true } } } }),
    ]);
    return { dsa, projects };
  },

  async reviewDsa(actorId: string, submissionId: string, input: Record<string, unknown>) {
    const submission = await prisma.dsaTournamentSubmission.findUnique({ where: { id: submissionId }, include: { question: true } });
    if (!submission) throw adminError("DSA submission not found.", 404);
    const status = clean(input.status, 60) as TournamentSubmissionStatus;
    const allowed = ["Accepted", "Wrong_Answer", "Time_Limit_Exceeded", "Memory_Limit_Exceeded", "Runtime_Error", "Compilation_Error", "Disqualified", "Under_Review"];
    if (!allowed.includes(status)) throw adminError("Submission status is invalid.");
    const score = status === "Accepted" ? Math.max(0, Math.min(submission.question.points, Number(input.score) || submission.question.points)) : 0;
    const updated = await prisma.dsaTournamentSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        score,
        passedTests: Math.max(0, Number(input.passedTests) || 0),
        totalTests: Math.max(0, Number(input.totalTests) || submission.totalTests),
        executionTimeMs: input.executionTimeMs ? Math.max(0, Number(input.executionTimeMs)) : null,
        memoryUsedKb: input.memoryUsedKb ? Math.max(0, Number(input.memoryUsedKb)) : null,
        judgeOutput: clean(input.judgeOutput, 8000) || null,
        adminNotes: clean(input.adminNotes, 8000) || null,
      },
    });
    await recalculateDsaRegistration(submission.tournamentId, submission.userId);
    await audit(actorId, "REVIEW_DSA_SUBMISSION", "DsaTournamentSubmission", submissionId, { status, score }, clean(input.adminNotes, 500));
    return updated;
  },

  async reviewProject(actorId: string, submissionId: string, input: Record<string, unknown>) {
    const submission = await prisma.projectTournamentSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) throw adminError("Project submission not found.", 404);
    const manualScore = Math.max(0, Math.min(25, Number(input.manualScore) || 0));
    const finalScore = Number(Math.min(100, submission.automatedScore + manualScore).toFixed(2));
    const updated = await prisma.projectTournamentSubmission.update({
      where: { id: submissionId },
      data: {
        manualScore,
        finalScore,
        status: (clean(input.status, 40) || "Scored") as TournamentSubmissionStatus,
        rubricScores: jsonValue(input.rubricScores),
        adminNotes: clean(input.adminNotes, 8000) || null,
      },
    });
    if (submission.teamId) await prisma.tournamentRegistration.updateMany({ where: { tournamentId: submission.tournamentId, teamId: submission.teamId }, data: { finalScore } });
    else if (submission.userId) await prisma.tournamentRegistration.update({ where: { tournamentId_userId: { tournamentId: submission.tournamentId, userId: submission.userId } }, data: { finalScore } });
    await audit(actorId, "REVIEW_PROJECT_SUBMISSION", "ProjectTournamentSubmission", submissionId, { manualScore, finalScore }, clean(input.adminNotes, 500));
    return updated;
  },

  async publishResults(actorId: string, tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw adminError("Tournament not found.", 404);
    const awardedUsers: string[] = [];

    await prisma.$transaction(async (tx) => {
      if (tournament.type === "Project") {
        const submissions = await tx.projectTournamentSubmission.findMany({
          where: { tournamentId, status: { in: ["Submitted", "Under_Review", "Scored", "Accepted"] } },
          orderBy: [{ finalScore: "desc" }, { submittedAt: "asc" }],
        });
        const awardedRegistrationIds = new Set<string>();
        for (let index = 0; index < submissions.length; index += 1) {
          const submission = submissions[index];
          const rank = index + 1;
          const basePoints = submission.finalScore > 0 ? awardForRank(rank, submissions.length, tournament) : 0;
          const registrations = await tx.tournamentRegistration.findMany({
            where: submission.teamId
              ? { tournamentId, teamId: submission.teamId, status: { notIn: ["Withdrawn", "Disqualified"] } }
              : { tournamentId, userId: submission.userId || "", status: { notIn: ["Withdrawn", "Disqualified"] } },
          });
          const weightByUser = new Map<string, number>();
          if (Array.isArray(submission.memberContributionWeights)) {
            for (const item of submission.memberContributionWeights) {
              if (!item || typeof item !== "object" || Array.isArray(item)) continue;
              const evidence = item as Prisma.JsonObject;
              const evidenceUserId = String(evidence.userId || "");
              if (!evidenceUserId) continue;
              weightByUser.set(evidenceUserId, Math.max(0, Number(evidence.contributionWeight) || 0));
            }
          }
          const maxWeight = Math.max(0, ...weightByUser.values());
          for (const registration of registrations) {
            const memberWeight = weightByUser.get(registration.userId);
            const contributionFactor = submission.teamId && maxWeight > 0 && memberWeight !== undefined
              ? 0.5 + 0.5 * Math.min(1, memberWeight / maxWeight)
              : 1;
            const points = Number((basePoints * contributionFactor).toFixed(2));
            await tx.tournamentRegistration.update({
              where: { id: registration.id },
              data: { finalRank: rank, finalScore: submission.finalScore, arenaPointsAwarded: points, status: "Completed" },
            });
            await tx.scoreEvent.upsert({
              where: { userId_sourceType_sourceId: { userId: registration.userId, sourceType: "TournamentResult", sourceId: registration.id } },
              create: { userId: registration.userId, category: "Challenge", sourceType: "TournamentResult", sourceId: registration.id, label: `${tournament.title} placement`, points, occurredAt: new Date() },
              update: { points, label: `${tournament.title} placement`, occurredAt: new Date() },
            });
            awardedRegistrationIds.add(registration.id);
            awardedUsers.push(registration.userId);
            await rebuildUserScoreState(tx, registration.userId);
          }
        }
        await tx.tournamentRegistration.updateMany({
          where: { tournamentId, id: { notIn: [...awardedRegistrationIds] }, status: { notIn: ["Withdrawn", "Disqualified"] } },
          data: { status: "Completed", finalRank: null, arenaPointsAwarded: 0 },
        });
      } else {
        const registrations = await tx.tournamentRegistration.findMany({
          where: { tournamentId, status: { notIn: ["Withdrawn", "Disqualified"] } },
          orderBy: [{ finalScore: "desc" }, { registeredAt: "asc" }],
        });
        for (let index = 0; index < registrations.length; index += 1) {
          const registration = registrations[index];
          const rank = index + 1;
          const points = registration.finalScore > 0 ? awardForRank(rank, registrations.length, tournament) : 0;
          await tx.tournamentRegistration.update({ where: { id: registration.id }, data: { finalRank: rank, arenaPointsAwarded: points, status: "Completed" } });
          await tx.scoreEvent.upsert({
            where: { userId_sourceType_sourceId: { userId: registration.userId, sourceType: "TournamentResult", sourceId: registration.id } },
            create: { userId: registration.userId, category: "Challenge", sourceType: "TournamentResult", sourceId: registration.id, label: `${tournament.title} placement`, points, occurredAt: new Date() },
            update: { points, label: `${tournament.title} placement`, occurredAt: new Date() },
          });
          awardedUsers.push(registration.userId);
          await rebuildUserScoreState(tx, registration.userId);
        }
      }
      await tx.tournament.update({ where: { id: tournamentId }, data: { status: "Completed", resultsPublishedAt: new Date() } });
    });
    const recipients = [...new Set(awardedUsers)];
    await publishRealtimeEvents(recipients, { type: "tournaments.results.published", entityType: "Tournament", entityId: tournamentId, payload: { tournamentId } });
    await audit(actorId, "PUBLISH_RESULTS", "Tournament", tournamentId, { participants: recipients.length });
    return { published: true, participants: recipients.length };
  },

  async createAnnouncement(actorId: string, tournamentId: string, input: Record<string, unknown>) {
    const title = clean(input.title, 160);
    const message = clean(input.message, 8000);
    if (!title || !message) throw adminError("Announcement title and message are required.");
    const announcement = await prisma.tournamentAnnouncement.create({ data: { tournamentId, authorId: actorId, title, message } });
    const recipients = await prisma.tournamentRegistration.findMany({ where: { tournamentId, status: { not: "Withdrawn" } }, select: { userId: true } });
    await publishRealtimeEvents(recipients.map((item) => item.userId), { type: "tournaments.announcement", entityType: "Tournament", entityId: tournamentId, payload: { announcementId: announcement.id, title } });
    await audit(actorId, "CREATE_ANNOUNCEMENT", "TournamentAnnouncement", announcement.id, { tournamentId, title });
    return announcement;
  },

  async moderation() {
    const [feedback, reports, auditLogs] = await Promise.all([
      prisma.feedbackSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true, username: true, email: true } } } }),
      prisma.playerReport.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { reporter: { select: { name: true, username: true, email: true } } } }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 150, include: { actor: { select: { name: true, username: true, email: true } } } }),
    ]);

    const idsFor = (type: string) => reports.filter((item) => item.subjectType.toLowerCase() === type).map((item) => item.subjectId);
    const personSelect = { name: true, username: true, email: true } as const;
    const [players, projects, collaborations, posts, conversations] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: idsFor("player") } }, select: { id: true, ...personSelect } }),
      prisma.project.findMany({ where: { id: { in: idsFor("project") } }, select: { id: true, title: true, user: { select: personSelect } } }),
      prisma.collaborationPost.findMany({ where: { id: { in: idsFor("collaboration") } }, select: { id: true, title: true, author: { select: personSelect } } }),
      prisma.communityPost.findMany({ where: { id: { in: idsFor("post") } }, select: { id: true, title: true, author: { select: personSelect } } }),
      prisma.directConversation.findMany({ where: { id: { in: idsFor("conversation") } }, select: { id: true, userA: { select: personSelect }, userB: { select: personSelect } } }),
    ]);
    const playerMap = new Map(players.map((item) => [item.id, { label: `${item.name} (@${item.username})`, owner: item }]));
    const projectMap = new Map(projects.map((item) => [item.id, { label: item.title, owner: item.user }]));
    const collaborationMap = new Map(collaborations.map((item) => [item.id, { label: item.title, owner: item.author }]));
    const postMap = new Map(posts.map((item) => [item.id, { label: item.title, owner: item.author }]));
    const conversationMap = new Map(conversations.map((item) => [item.id, { label: `Conversation: @${item.userA.username} and @${item.userB.username}`, owner: null }]));
    const readableReports = reports.map((item) => {
      const type = item.subjectType.toLowerCase();
      const subject = type === "player" ? playerMap.get(item.subjectId)
        : type === "project" ? projectMap.get(item.subjectId)
          : type === "collaboration" ? collaborationMap.get(item.subjectId)
            : type === "post" ? postMap.get(item.subjectId)
              : type === "conversation" ? conversationMap.get(item.subjectId)
                : undefined;
      return { ...item, subject: subject || { label: item.subjectType.replaceAll("_", " "), owner: null } };
    });
    return { feedback, reports: readableReports, auditLogs };
  },

  async systemHealth() {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const [webhookFailures, refreshJobs, judgeQueue, realtimeEvents] = await Promise.all([
      prisma.gitHubWebhookDelivery.count({ where: { status: { in: ["Failed", "Rejected"] } } }),
      prisma.gitHubProjectRefreshJob.count(),
      prisma.dsaTournamentSubmission.count({ where: { status: { in: ["Queued", "Running"] } } }),
      prisma.realtimeEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
    ]);
    return { status: "ok", databaseLatencyMs: Date.now() - start, webhookFailures, refreshJobs, judgeQueue, realtimeEventsLastHour: realtimeEvents, judgeConfigured: Boolean(process.env.TOURNAMENT_JUDGE_URL), webhookConfigured: Boolean(process.env.GITHUB_WEBHOOK_SECRET) };
  },
};
