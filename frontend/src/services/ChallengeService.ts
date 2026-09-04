import { apiRequest } from "./ApiClient";

// ── Types ────────────────────────────────────────────────────────

export type CompetitionTaskType = "DSA" | "Development" | "Debugging";
export type SubmissionStatus = "Pending" | "Evaluating" | "Passed" | "Partial" | "Failed" | "Error";

export type UserSubmission = {
  id: string;
  status: SubmissionStatus;
  language: string;
  correctness: number;
  efficiency: number;
  testsPassed: number;
  testsTotal: number;
  submittedAt: string;
};

export type CompetitionTask = {
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
  userSubmission: UserSubmission | null;
};

export type ActiveCompetition = {
  id: string;
  title: string;
  weekStart: string;
  status: "Draft" | "Active" | "Evaluating" | "Completed";
  opensAt: string | null;
  closesAt: string | null;
  tasks: CompetitionTask[];
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

export type CompetitionResults = {
  competition: {
    id: string;
    title: string;
    weekStart: string;
    status: string;
  };
  results: CompetitionResultEntry[];
  currentUser: CompetitionResultEntry | null;
};

// ── API ──────────────────────────────────────────────────────────

export function getActiveCompetition() {
  return apiRequest<ActiveCompetition | null>("/api/challenge");
}

export function submitCode(taskId: string, code: string, language: string) {
  return apiRequest<UserSubmission>("/api/challenge/submit", {
    method: "POST",
    body: JSON.stringify({ taskId, code, language }),
  });
}

export function getCompetitionResults(weekStart?: string) {
  const params = weekStart ? `?weekStart=${weekStart}` : "";
  return apiRequest<CompetitionResults>(`/api/challenge/results${params}`);
}
