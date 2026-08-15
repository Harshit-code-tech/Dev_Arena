import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type PracticeType = "DSA_Revision" | "Concept_Explanation";
export type FullstackCategory = "Course_Progress" | "Practical_Work";
export type FullstackType = "Learning" | "Building";
export type ProjectDomain = "Fullstack" | "App" | "AI" | "Other";
export type ProjectStatus = "In_Progress" | "Completed";
export type MilestoneStatus = "Pending" | "Completed";

export type GitHubLanguage = {
  name: string;
  percentage: number;
  bytes?: number;
};

export type GitHubTechnology = {
  name: string;
  evidence: string[];
};

export type DsaLog = {
  id: string;
  problemName: string;
  url: string | null;
  solutionUrl: string | null;
  difficulty: Difficulty;
  timeTaken: number;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  notes: string | null;
  activityDate: string;
  createdAt: string;
  updatedAt: string;
  points: number;
};

export type PracticeLog = {
  id: string;
  title: string;
  type: PracticeType;
  notes: string | null;
  timeSpent: number;
  proofLink: string | null;
  activityDate: string;
  createdAt: string;
  updatedAt: string;
  points: number;
};

export type FullstackLog = {
  id: string;
  title: string;
  category: FullstackCategory;
  type: FullstackType;
  description: string | null;
  timeSpent: number;
  proofLink: string | null;
  activityDate: string;
  createdAt: string;
  updatedAt: string;
  points: number;
};

export type ProjectLog = {
  id: string;
  projectId: string;
  description: string;
  timeSpent: number;
  proofLink: string | null;
  activityDate: string;
  createdAt: string;
  updatedAt: string;
};

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  completionAwardedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  title: string;
  description: string | null;
  domain: ProjectDomain;
  status: ProjectStatus;
  startDate: string;
  completionAwardedAt: string | null;
  isShared: boolean;
  shareSlug: string | null;
  sharedAt: string | null;
  githubRepositoryUrl: string | null;
  githubRepositoryId: string | null;
  githubRepositoryNodeId: string | null;
  githubOwnerId: string | null;
  githubRepositoryOwner: string | null;
  githubRepositoryName: string | null;
  githubRepositoryFullName: string | null;
  githubRepositoryPrivate: boolean | null;
  githubVisibility: string | null;
  githubRepositoryDefaultBranch: string | null;
  githubPermission: string | null;
  githubRoleName: string | null;
  githubLanguages: GitHubLanguage[] | null;
  githubLanguagesFetchedAt: string | null;
  githubTechnologyStack: GitHubTechnology[] | null;
  githubTechnologyFetchedAt: string | null;
  githubTechnologyStatus: string | null;
  githubLastPushedAt: string | null;
  githubVerifiedAt: string | null;
  githubLastCheckedAt: string | null;
  githubAccessStatus: string | null;
  githubLanguageBytes: Record<string, number> | null;
  githubIsFork: boolean | null;
  githubParentFullName: string | null;
  githubContributionStatus: string | null;
  githubContributorCommits: number | null;
  githubRepositoryCommits: number | null;
  githubUserAdditions: number | null;
  githubUserDeletions: number | null;
  githubContributionPercent: number | null;
  githubContributionWeight: number | null;
  githubContributionVerifiedAt: string | null;
  githubEligibleForTechStack: boolean;
  githubEligibilityReason: string | null;
  githubVerificationVersion: string | null;
  githubRepositorySizeKb: number | null;
  githubSourceBytes: number | null;
  projectScore: number;
  projectScoreUpdatedAt: string | null;
  projectScoreVersion: string | null;
  createdAt: string;
  updatedAt: string;
  logs: ProjectLog[];
  milestones: Milestone[];
  metrics: {
    totalSessions: number;
    completedMilestones: number;
    totalMilestones: number;
    milestoneProgress: number;
    score: number;
  };
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export type DsaData = {
  logs: DsaLog[];
  summary: {
    weeklySolved: number;
    weeklyPoints: number;
    targetMinimum: number;
    targetMaximum: number;
    breakdown: Record<Difficulty, number>;
  };
};

export type PracticeData = {
  logs: PracticeLog[];
  summary: {
    weeklyActivities: number;
    weeklyPoints: number;
    revisions: number;
    learningSessions: number;
  };
};

export type FullstackData = {
  logs: FullstackLog[];
  summary: {
    weeklyActivities: number;
    weeklyPoints: number;
    courseProgress: number;
    practicalTasks: number;
    learning: number;
    building: number;
    targetSections: string;
    targetTasks: string;
  };
};

export type ProjectData = {
  projects: Project[];
  summary: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalSessions: number;
    projectPoints: number;
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "The tracking request failed.");
  }

  return payload.data;
}

export const trackingApi = {
  getDsa: () => request<DsaData>("/api/dsa"),
  createDsa: (input: Record<string, unknown>) => request<DsaLog>("/api/dsa", { method: "POST", body: JSON.stringify(input) }),
  updateDsa: (id: string, input: Record<string, unknown>) => request<DsaLog>(`/api/dsa/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteDsa: (id: string) => request<never>(`/api/dsa/${id}`, { method: "DELETE" }),

  getPractice: () => request<PracticeData>("/api/practice"),
  createPractice: (input: Record<string, unknown>) => request<PracticeLog>("/api/practice", { method: "POST", body: JSON.stringify(input) }),
  updatePractice: (id: string, input: Record<string, unknown>) => request<PracticeLog>(`/api/practice/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deletePractice: (id: string) => request<never>(`/api/practice/${id}`, { method: "DELETE" }),

  getFullstack: () => request<FullstackData>("/api/fullstack"),
  createFullstack: (input: Record<string, unknown>) => request<FullstackLog>("/api/fullstack", { method: "POST", body: JSON.stringify(input) }),
  updateFullstack: (id: string, input: Record<string, unknown>) => request<FullstackLog>(`/api/fullstack/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteFullstack: (id: string) => request<never>(`/api/fullstack/${id}`, { method: "DELETE" }),

  getProjects: () => request<ProjectData>("/api/projects"),
  createProject: (input: Record<string, unknown>) => request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (id: string, input: Record<string, unknown>) => request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  updateProjectSharing: (id: string, enabled: boolean) => request<Project>(`/api/projects/${id}/sharing`, { method: "PUT", body: JSON.stringify({ enabled }) }),
  attachProjectRepository: (id: string, repositoryUrl: string) => request<Project>(`/api/projects/${id}/github`, { method: "POST", body: JSON.stringify({ repositoryUrl }) }),
  refreshProjectRepository: (id: string) => request<Project>(`/api/projects/${id}/github/refresh`, { method: "POST" }),
  reverifyProjectRepositories: () => request<{ checked: number; verified: number; failed: number }>("/api/projects/github/reverify", { method: "POST" }),
  addProjectLog: (projectId: string, input: Record<string, unknown>) => request<ProjectLog>(`/api/projects/${projectId}/logs`, { method: "POST", body: JSON.stringify(input) }),
  updateProjectLog: (projectId: string, logId: string, input: Record<string, unknown>) => request<ProjectLog>(`/api/projects/${projectId}/logs/${logId}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteProjectLog: (projectId: string, logId: string) => request<never>(`/api/projects/${projectId}/logs/${logId}`, { method: "DELETE" }),
  addMilestone: (projectId: string, input: Record<string, unknown>) => request<Milestone>(`/api/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(input) }),
  updateMilestone: (projectId: string, milestoneId: string, input: Record<string, unknown>) => request<Milestone>(`/api/projects/${projectId}/milestones/${milestoneId}`, { method: "PUT", body: JSON.stringify(input) }),
};

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function displayActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function displayActivityDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function canEdit(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() <= 24 * 60 * 60 * 1000;
}
