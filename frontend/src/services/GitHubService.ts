import { apiRequest } from "./ApiClient";

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


const GITHUB_RETURN_POSITION_KEY = "devarena:github:return-position";

type GitHubReturnPosition = {
  path: string;
  scrollX: number;
  scrollY: number;
  savedAt: number;
};

function currentReturnPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function startPayload(returnPath?: string) {
  return JSON.stringify({
    returnOrigin: window.location.origin,
    returnPath: returnPath || currentReturnPath(),
  });
}

export function rememberGitHubReturnPosition() {
  const value: GitHubReturnPosition = {
    path: currentReturnPath(),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(GITHUB_RETURN_POSITION_KEY, JSON.stringify(value));
  } catch {
    // Returning to the correct route still works when sessionStorage is blocked.
  }
}

export function restoreGitHubReturnPosition() {
  try {
    const raw = sessionStorage.getItem(GITHUB_RETURN_POSITION_KEY);
    if (!raw) return;
    const value = JSON.parse(raw) as Partial<GitHubReturnPosition>;
    sessionStorage.removeItem(GITHUB_RETURN_POSITION_KEY);
    if (typeof value.savedAt !== "number" || Date.now() - value.savedAt > 20 * 60 * 1000) return;
    if (typeof value.scrollX !== "number" || typeof value.scrollY !== "number") return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo(value.scrollX!, value.scrollY!));
    });
  } catch {
    // Ignore malformed or unavailable session storage.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("GitHub could not be reached. Check the API URL and your internet connection, then try again.");
    }
    throw error;
  }
}

export const GitHubApi = {
  status: () => request<GitHubConnectionStatus>("/api/github/status"),
  topTechStack: () => request<TopTechStack>("/api/github/tech-stack"),
  rebuildTopTechStack: () => request<TopTechStack>("/api/github/tech-stack/rebuild", { method: "POST" }),
  startConnection: (returnPath?: string) => request<{ authorizationUrl: string }>("/api/github/connect", {
    method: "POST",
    body: startPayload(returnPath),
  }),
  startInstallation: (returnPath?: string) => request<{ installationUrl: string }>("/api/github/install", {
    method: "POST",
    body: startPayload(returnPath),
  }),
  verifyRepository: (repositoryUrl: string) => request<VerifiedGitHubRepository>("/api/github/verify", {
    method: "POST",
    body: JSON.stringify({ repositoryUrl }),
  }),
  disconnect: () => request<{ disconnected: boolean }>("/api/github/connection", { method: "DELETE" }),
};
