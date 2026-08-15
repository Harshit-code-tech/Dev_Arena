import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type GitHubLanguage = {
  name: string;
  percentage: number;
  bytes?: number;
};

export type TopTechStackItem = {
  name: string;
  percentage: number;
  projectCount: number;
};

export type TopTechStack = {
  items: TopTechStackItem[];
  eligibleProjectCount: number;
  updatedAt: string | null;
};

export type GitHubConnectionStatus = {
  connected: boolean;
  githubLogin: string | null;
  connectedAt: string | null;
  repositoryCount: number;
  installationCount: number;
  privateRepositoryAccess: boolean;
  repositorySelections: string[];
  configReady: boolean;
  missingConfiguration: string[];
  callbackUrl: string;
  setupUrl: string;
  webhookUrl: string | null;
  accessError?: string | null;
  technologyPermissionRequired?: number;
};

export type VerifiedGitHubRepository = {
  url: string;
  fullName: string;
  languages: GitHubLanguage[];
  verifiedAt: string;
  techStackEligible: boolean;
  contributionStatus: string;
  eligibilityReason: string;
  isFork: boolean;
};

type Envelope<T> = { success: boolean; data: T; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("GitHub could not be reached. Check your internet connection and try again.");
  }
  const payload = await response.json().catch(() => ({})) as Partial<Envelope<T>>;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || "GitHub request failed.");
  }
  return payload.data as T;
}

export const GitHubApi = {
  status: () => request<GitHubConnectionStatus>("/api/github/status"),
  topTechStack: () => request<TopTechStack>("/api/github/tech-stack"),
  rebuildTopTechStack: () => request<TopTechStack>("/api/github/tech-stack/rebuild", { method: "POST" }),
  startConnection: () => request<{ authorizationUrl: string }>("/api/github/connect", { method: "POST" }),
  startInstallation: () => request<{ installationUrl: string }>("/api/github/install", { method: "POST" }),
  verifyRepository: (repositoryUrl: string) => request<VerifiedGitHubRepository>("/api/github/verify", {
    method: "POST",
    body: JSON.stringify({ repositoryUrl }),
  }),
  disconnect: () => request<{ disconnected: boolean }>("/api/github/connection", { method: "DELETE" }),
};
