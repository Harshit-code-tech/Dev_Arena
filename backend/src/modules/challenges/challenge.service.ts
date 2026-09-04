import { prisma } from "../../database/prisma";
import { TrackingError, getWeekStart } from "../../shared/utils/tracking";
import type { CompetitionSubmissionStatus } from "@prisma/client";
import type {
    ActiveCompetitionResponse,
    CompetitionResultEntry,
    CompetitionResultsResponse,
    CompetitionTaskPublic,
    CreateCompetitionInput,
    CreateTaskInput,
    CreateTestCaseInput,
    SubmitCodeInput,
    UserSubmissionSummary,
} from "./challenge.types";

// ── Helpers ──────────────────────────────────────────────────────

function currentWeekStart() {
    return getWeekStart(new Date());
}

function mapSubmission(sub: {
    id: string;
    status: CompetitionSubmissionStatus;
    language: string;
    correctness: number;
    efficiency: number;
    testsPassed: number;
    testsTotal: number;
    submittedAt: Date;
}): UserSubmissionSummary {
    return {
        id: sub.id,
        status: sub.status,
        language: sub.language,
        correctness: sub.correctness,
        efficiency: sub.efficiency,
        testsPassed: sub.testsPassed,
        testsTotal: sub.testsTotal,
        submittedAt: sub.submittedAt,
    };
}



/** User select shape for competition result displays. */
const leaderboardUserSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    avatarUrl: true,
    useInitials: true,
    arenaScore: true,
    seasonPoints: true,
    activeDays: true,
    rank: true,
    createdAt: true,
} as const;

// ── Service ──────────────────────────────────────────────────────

export const challengeService = {

    // ─── Player-facing ───────────────────────────────────────────

    async getActiveCompetition(userId: string): Promise<ActiveCompetitionResponse | null> {
        const competition = await prisma.weeklyCompetition.findUnique({
            where: { weekStart: currentWeekStart() },
            include: {
                tasks: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                        testCases: true,
                        submissions: { where: { userId } },
                    },
                },
            },
        });

        if (!competition || competition.status === "Draft") return null;

        const tasks: CompetitionTaskPublic[] = competition.tasks.map((task) => ({
            id: task.id,
            type: task.type,
            title: task.title,
            description: task.description,
            difficulty: task.difficulty,
            sortOrder: task.sortOrder,
            weightPercentage: task.weightPercentage,
            timeLimitMs: task.timeLimitMs,
            memoryLimitMb: task.memoryLimitMb,
            sampleTestCases: task.testCases
                .filter((tc) => !tc.isHidden)
                .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
            userSubmission: task.submissions[0] ? mapSubmission(task.submissions[0]) : null,
        }));

        return {
            id: competition.id,
            title: competition.title,
            weekStart: competition.weekStart,
            status: competition.status,
            opensAt: competition.opensAt,
            closesAt: competition.closesAt,
            tasks,
        };
    },

    async submitCode(userId: string, input: SubmitCodeInput): Promise<UserSubmissionSummary> {
        const code = (input.code ?? "").trim();
        const language = (input.language ?? "").trim();
        const taskId = (input.taskId ?? "").trim();

        if (!code) throw new TrackingError("Code submission cannot be empty.");
        if (!language) throw new TrackingError("Programming language is required.");
        if (!taskId) throw new TrackingError("Task ID is required.");

        const task = await prisma.competitionTask.findUnique({
            where: { id: taskId },
            include: { competition: true },
        });

        if (!task) throw new TrackingError("Competition task not found.", 404);
        if (task.competition.status !== "Active") {
            throw new TrackingError("This competition is not currently accepting submissions.");
        }
        if (task.competition.closesAt && new Date() > task.competition.closesAt) {
            throw new TrackingError("The submission deadline for this competition has passed.");
        }

        const opensAt = task.competition.opensAt ?? task.competition.createdAt;
        const completionTime = Math.max(0, Math.floor((Date.now() - opensAt.getTime()) / 1000));

        const submission = await prisma.competitionSubmission.upsert({
            where: { taskId_userId: { taskId, userId } },
            create: { taskId, userId, code, language, completionTime, status: "Pending" },
            update: {
                code,
                language,
                completionTime,
                status: "Pending" as CompetitionSubmissionStatus,
                correctness: 0,
                efficiency: 0,
                testsPassed: 0,
                testsTotal: 0,
                evaluationLog: null,
                evaluatedAt: null,
                submittedAt: new Date(),
            },
        });

        return mapSubmission(submission);
    },

    async getResults(userId: string, weekStartParam?: string): Promise<CompetitionResultsResponse> {
        const weekStart = weekStartParam
            ? getWeekStart(new Date(weekStartParam))
            : currentWeekStart();

        const competition = await prisma.weeklyCompetition.findUnique({
            where: { weekStart },
        });
        if (!competition) throw new TrackingError("No competition found for this week.", 404);

        const results = await prisma.challengeResult.findMany({
            where: { weekStart },
            orderBy: [
                { score: "desc" },
                { correctness: "desc" },
                { problemsSolved: "desc" },
                { efficiency: "desc" },
                { completionTime: "asc" },
                { id: "asc" },
            ],
            include: { user: { select: leaderboardUserSelect } },
        });

        const entries: CompetitionResultEntry[] = results.map((result, index) => ({
            userId: result.user.id,
            name: result.user.name,
            username: result.user.username,
            avatarUrl: result.user.avatarUrl,
            useInitials: result.user.useInitials,
            rank: result.user.rank,
            score: result.score,
            correctness: result.correctness,
            problemsSolved: result.problemsSolved,
            efficiency: result.efficiency,
            completionTime: result.completionTime,
            position: index + 1,
            isCurrentUser: result.userId === userId,
        }));

        return {
            competition: {
                id: competition.id,
                title: competition.title,
                weekStart: competition.weekStart,
                status: competition.status,
            },
            results: entries,
            currentUser: entries.find((e) => e.isCurrentUser) ?? null,
        };
    },

    // ─── Admin ───────────────────────────────────────────────────

    async createCompetition(input: CreateCompetitionInput) {
        const title = (input.title ?? "").trim();
        if (!title) throw new TrackingError("Competition title is required.");

        const weekStart = getWeekStart(new Date(input.weekStart));
        if (Number.isNaN(weekStart.getTime())) throw new TrackingError("Invalid week start date.");

        const existing = await prisma.weeklyCompetition.findUnique({ where: { weekStart } });
        if (existing) throw new TrackingError("A competition already exists for this week.");

        return prisma.weeklyCompetition.create({
            data: {
                weekStart,
                title,
                status: "Draft",
                opensAt: input.opensAt ? new Date(input.opensAt) : null,
                closesAt: input.closesAt ? new Date(input.closesAt) : null,
            },
        });
    },

    async activateCompetition(competitionId: string) {
        const competition = await prisma.weeklyCompetition.findUnique({
            where: { id: competitionId },
            include: { tasks: { include: { testCases: true } } },
        });

        if (!competition) throw new TrackingError("Competition not found.", 404);
        if (competition.status !== "Draft") throw new TrackingError("Only draft competitions can be activated.");
        if (competition.tasks.length === 0) throw new TrackingError("Add at least one task before activating.");

        const tasksWithoutTests = competition.tasks.filter((t) => t.testCases.length === 0);
        if (tasksWithoutTests.length > 0) {
            throw new TrackingError(
                `Tasks without test cases: ${tasksWithoutTests.map((t) => t.title).join(", ")}`,
            );
        }

        return prisma.weeklyCompetition.update({
            where: { id: competitionId },
            data: { status: "Active", opensAt: competition.opensAt ?? new Date() },
        });
    },

    async createTask(input: CreateTaskInput) {
        const title = (input.title ?? "").trim();
        const description = (input.description ?? "").trim();
        if (!title) throw new TrackingError("Task title is required.");
        if (!description) throw new TrackingError("Task description is required.");

        const competition = await prisma.weeklyCompetition.findUnique({
            where: { id: input.competitionId },
        });
        if (!competition) throw new TrackingError("Competition not found.", 404);
        if (competition.status !== "Draft") throw new TrackingError("Tasks can only be added to draft competitions.");

        return prisma.competitionTask.create({
            data: {
                competition: { connect: { id: input.competitionId } },
                type: input.type,
                title,
                description,
                difficulty: input.difficulty,
                sortOrder: input.sortOrder ?? 0,
                inputConstraints: input.inputConstraints ?? null,
                expectedTime: input.expectedTime ?? null,
                expectedSpace: input.expectedSpace ?? null,
                acceptedTimeTiers: input.acceptedTimeTiers ?? undefined,
                memoryLimitMb: input.memoryLimitMb ?? null,
                timeLimitMs: input.timeLimitMs ?? null,
                correctnessWeight: input.correctnessWeight ?? 0.70,
                efficiencyWeight: input.efficiencyWeight ?? 0.20,
                timeWeight: input.timeWeight ?? 0.10,
                weightPercentage: input.weightPercentage ?? 50,
            },
        });
    },

    async createTestCase(input: CreateTestCaseInput) {
        const task = await prisma.competitionTask.findUnique({
            where: { id: input.taskId },
            include: { competition: true },
        });
        if (!task) throw new TrackingError("Task not found.", 404);
        if (task.competition.status !== "Draft") {
            throw new TrackingError("Test cases can only be added to tasks in draft competitions.");
        }

        return prisma.competitionTestCase.create({
            data: {
                task: { connect: { id: input.taskId } },
                input: input.input,
                expectedOutput: input.expectedOutput,
                isHidden: input.isHidden ?? false,
                weight: input.weight ?? 1,
            },
        });
    },

    // ─── Scoring aggregation ─────────────────────────────────────

    async aggregateResults(competitionId: string) {
        const competition = await prisma.weeklyCompetition.findUnique({
            where: { id: competitionId },
            include: {
                tasks: {
                    select: {
                        id: true,
                        correctnessWeight: true,
                        efficiencyWeight: true,
                        timeWeight: true,
                        weightPercentage: true,
                        submissions: true,
                    },
                },
            },
        });
        if (!competition) throw new TrackingError("Competition not found.", 404);

        const participantIds = new Set<string>();
        for (const task of competition.tasks) {
            for (const sub of task.submissions) {
                participantIds.add(sub.userId);
            }
        }

        // Find fastest completion per task for time normalization
        const fastestTimeByTask = new Map<string, number>();
        for (const task of competition.tasks) {
            const times = task.submissions
                .filter((s) => s.status === "Passed" || s.status === "Partial")
                .map((s) => s.completionTime);
            if (times.length > 0) fastestTimeByTask.set(task.id, Math.min(...times));
        }

        const resultData = Array.from(participantIds).map((uid) => {
            let totalScore = 0;
            let totalCorrectness = 0;
            let totalEfficiency = 0;
            let problemsSolved = 0;
            let totalCompletionTime = 0;
            let taskCount = 0;

            for (const task of competition.tasks) {
                const sub = task.submissions.find((s) => s.userId === uid);
                if (!sub) continue;

                taskCount++;
                totalCompletionTime += sub.completionTime;
                totalCorrectness += sub.correctness;
                totalEfficiency += sub.efficiency;
                if (sub.status === "Passed") problemsSolved++;

                const fastest = fastestTimeByTask.get(task.id) ?? sub.completionTime;
                const timeScore = fastest > 0 && sub.completionTime > 0
                    ? Math.max(0, 100 * (fastest / sub.completionTime))
                    : (sub.completionTime === 0 ? 100 : 0);

                const taskScore =
                    sub.correctness * task.correctnessWeight +
                    sub.efficiency * task.efficiencyWeight +
                    timeScore * task.timeWeight;

                totalScore += taskScore * (task.weightPercentage / 100);
            }

            return {
                userId: uid,
                score: Math.round(totalScore * 100) / 100,
                correctness: taskCount > 0 ? Math.round((totalCorrectness / taskCount) * 100) / 100 : 0,
                problemsSolved,
                efficiency: taskCount > 0 ? Math.round((totalEfficiency / taskCount) * 100) / 100 : 0,
                completionTime: totalCompletionTime,
            };
        });

        // Deterministic sort matching leaderboard orderBy
        resultData.sort((a, b) =>
            b.score - a.score ||
            b.correctness - a.correctness ||
            b.problemsSolved - a.problemsSolved ||
            b.efficiency - a.efficiency ||
            a.completionTime - b.completionTime,
        );

        await prisma.$transaction(async (tx) => {
            await tx.challengeResult.deleteMany({ where: { weekStart: competition.weekStart } });

            for (let i = 0; i < resultData.length; i++) {
                const data = resultData[i];
                await tx.challengeResult.create({
                    data: {
                        userId: data.userId,
                        weekStart: competition.weekStart,
                        score: data.score,
                        correctness: data.correctness,
                        problemsSolved: data.problemsSolved,
                        efficiency: data.efficiency,
                        completionTime: data.completionTime,
                        rank: i + 1,
                    },
                });
            }

            await tx.weeklyCompetition.update({
                where: { id: competitionId },
                data: { status: "Completed" },
            });

            await tx.realtimeEvent.create({
                data: {
                    userId: null,
                    type: "leaderboard.changed",
                    entityType: "competition",
                    entityId: competitionId,
                    payload: { weekStart: competition.weekStart },
                },
            });
        });

        return { aggregated: participantIds.size };
    },
};
