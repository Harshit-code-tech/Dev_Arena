import type { CompetitionStatus, CompetitionTaskType, CompetitionSubmissionStatus } from "@prisma/client";

// ── Response types ────────────────────────────────────────────────

/** Public task view (hides hidden test cases and authoritative metadata) */
export type CompetitionTaskPublic = {
    id: string;
    type: CompetitionTaskType;
    title: string;
    description: string;
    difficulty: string;
    sortOrder: number;
    weightPercentage: number;
    timeLimitMs: number | null;
    memoryLimitMb: number | null;
    sampleTestCases: { input: string; expectedOutput: string }[];
    userSubmission: UserSubmissionSummary | null;
};

export type UserSubmissionSummary = {
    id: string;
    status: CompetitionSubmissionStatus;
    language: string;
    correctness: number;
    efficiency: number;
    testsPassed: number;
    testsTotal: number;
    submittedAt: Date;
};

export type ActiveCompetitionResponse = {
    id: string;
    title: string;
    weekStart: Date;
    status: CompetitionStatus;
    opensAt: Date | null;
    closesAt: Date | null;
    tasks: CompetitionTaskPublic[];
};

export type CompetitionResultEntry = {
    userId: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    useInitials: boolean;
    rank: string;
    score: number;
    correctness: number;
    problemsSolved: number;
    efficiency: number;
    completionTime: number | null;
    position: number;
    isCurrentUser: boolean;
};

export type CompetitionResultsResponse = {
    competition: {
        id: string;
        title: string;
        weekStart: Date;
        status: CompetitionStatus;
    };
    results: CompetitionResultEntry[];
    currentUser: CompetitionResultEntry | null;
};

export type SubmitCodeInput = {
    taskId: string;
    code: string;
    language: string;
};

// ── Admin types ──────────────────────────────────────────────────

export type CreateCompetitionInput = {
    title: string;
    weekStart: string;
    opensAt?: string;
    closesAt?: string;
};

export type CreateTaskInput = {
    competitionId: string;
    type: CompetitionTaskType;
    title: string;
    description: string;
    difficulty: string;
    sortOrder?: number;
    inputConstraints?: string;
    expectedTime?: string;
    expectedSpace?: string;
    acceptedTimeTiers?: string[];
    memoryLimitMb?: number;
    timeLimitMs?: number;
    correctnessWeight?: number;
    efficiencyWeight?: number;
    timeWeight?: number;
    weightPercentage?: number;
};

export type CreateTestCaseInput = {
    taskId: string;
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
    weight?: number;
};
