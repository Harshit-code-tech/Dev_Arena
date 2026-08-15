import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { techStackService } from "./tech-stack.service";
import { rebuildProjectScoreEvents, rebuildProjectScoresForUser } from "../projects/project-scoring";
import { rebuildUserScoreState } from "../../shared/services/scoring.service";
import { publishRealtimeEvents } from "../realtime/realtime.service";

const GITHUB_API = "https://api.github.com";
const GITHUB_WEB = "https://github.com";
const API_VERSION = process.env.GITHUB_API_VERSION || "2022-11-28";
const DEFAULT_REVERIFY_HOURS = 12;
const CONTRIBUTION_VERIFICATION_VERSION = "github-contribution-v1";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

type GitHubApiErrorBody = {
  message?: string;
};

type GitHubInstallation = {
  id: number;
  account?: {
    id?: number;
    login?: string;
    slug?: string;
    type?: string;
  } | null;
  repository_selection?: string;
  permissions?: Record<string, string>;
  events?: string[];
};

type GitHubInstallationsResponse = {
  installations?: GitHubInstallation[];
};

export type GitHubLanguage = {
  name: string;
  percentage: number;
  bytes: number;
};

type GitHubRepositoryMetadata = {
  id: number;
  node_id?: string;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  visibility?: string;
  default_branch?: string;
  fork: boolean;
  pushed_at?: string | null;
  size?: number;
  owner: { id?: number; login: string };
  parent?: { full_name?: string } | null;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; triage?: boolean; pull?: boolean };
  role_name?: string | null;
};

type GitHubContributorStats = {
  total?: number;
  author?: { id?: number; login?: string } | null;
  weeks?: Array<{ a?: number; d?: number; c?: number }>;
};

type ContributionEvidence = {
  status: string;
  eligible: boolean;
  reason: string;
  permission: string;
  roleName: string | null;
  userCommits: number;
  repositoryCommits: number;
  additions: number;
  deletions: number;
  contributionPercent: number;
  contributionWeight: number;
};

export type VerifiedGitHubRepository = {
  url: string;
  fullName: string;
  languages: GitHubLanguage[];
  languageBytes: Record<string, number>;
  verifiedAt: Date;
  repository: GitHubRepositoryMetadata;
  contribution: ContributionEvidence;
};

export type TournamentRepositorySnapshot = {
  url: string;
  repositoryId: string;
  fullName: string;
  isPrivate: boolean;
  headSha: string | null;
  sourceBytes: number;
  repositorySizeKb: number;
  pushedAt: Date | null;
  languages: GitHubLanguage[];
  languageBytes: Record<string, number>;
  contributionStatus: string;
  contributionWeight: number;
  eligible: boolean;
  verifiedAt: Date;
};

function githubError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function errorStatus(error: unknown) {
  return typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: number }).statusCode) || 500
    : 500;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw githubError(`GitHub integration is not configured: ${name} is missing.`, 503);
  return value;
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

function callbackUrl() {
  return process.env.GITHUB_APP_CALLBACK_URL || "http://localhost:4000/api/github/callback";
}

function setupUrl() {
  return process.env.GITHUB_APP_SETUP_URL || "http://localhost:4000/api/github/setup";
}

function installUrl() {
  const slug = process.env.GITHUB_APP_SLUG?.trim();
  return slug ? `${GITHUB_WEB}/apps/${encodeURIComponent(slug)}/installations/new` : null;
}

function integrationConfigStatus() {
  const required = ["GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_SLUG"];
  return {
    ready: required.every((name) => Boolean(process.env[name]?.trim())),
    missing: required.filter((name) => !process.env[name]?.trim()),
    callbackUrl: callbackUrl(),
    setupUrl: setupUrl(),
    webhookUrl: process.env.GITHUB_WEBHOOK_URL || null,
  };
}

function tokenKey() {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw githubError("GitHub token encryption is not configured.", 503);
  return createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw githubError("Stored GitHub credentials are invalid. Reconnect GitHub.", 401);
  }
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function stateHash(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

function parseRepositoryUrl(value: unknown) {
  const raw = String(value || "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw githubError("Enter a valid GitHub repository URL.");
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw githubError("Use https://github.com/owner/repository.");
  }

  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw githubError("Use the repository root URL, not a profile, issue, pull request, branch, or commit URL.");
  }

  const owner = parts[0];
  const repository = parts[1].replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
    throw githubError("The GitHub repository URL contains invalid characters.");
  }

  return {
    owner,
    repository,
    fullName: `${owner}/${repository}`,
    normalizedUrl: `https://github.com/${owner}/${repository}`,
  };
}

function languageBreakdown(input: Record<string, number>): GitHubLanguage[] {
  const entries = Object.entries(input)
    .filter(([, bytes]) => Number.isFinite(bytes) && bytes > 0)
    .sort((left, right) => right[1] - left[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total === 0) return [];
  return entries.map(([name, bytes]) => ({
    name,
    bytes,
    percentage: Number(((bytes / total) * 100).toFixed(2)),
  }));
}

function configuredNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function contributionThresholds() {
  return {
    minCommits: Math.max(1, Math.round(configuredNumber("GITHUB_CONTRIBUTION_MIN_COMMITS", 3))),
    minChangedLines: Math.max(1, Math.round(configuredNumber("GITHUB_CONTRIBUTION_MIN_CHANGED_LINES", 200))),
    minCommitShare: Math.min(1, configuredNumber("GITHUB_CONTRIBUTION_MIN_COMMIT_SHARE", 0.5)),
    minChangeShare: Math.min(1, configuredNumber("GITHUB_CONTRIBUTION_MIN_CHANGE_SHARE", 0.4)),
    ownerMinCommits: Math.max(1, Math.round(configuredNumber("GITHUB_OWNER_MIN_COMMITS", 1))),
    ownerMinChangedLines: Math.max(1, Math.round(configuredNumber("GITHUB_OWNER_MIN_CHANGED_LINES", 20))),
  };
}

function permissionFromRepository(repository: GitHubRepositoryMetadata, githubLogin: string) {
  const permissions = repository.permissions || {};
  if (permissions.admin) return "admin";
  if (permissions.maintain) return "maintain";
  if (permissions.push) return "write";
  if (permissions.triage) return "triage";
  if (permissions.pull) return "read";
  if (repository.owner.login.toLowerCase() === githubLogin.toLowerCase()) return "admin";
  return "none";
}

function hasWritePermission(permission: string) {
  return permission === "admin" || permission === "maintain" || permission === "write";
}

async function exchangeAuthorizationCode(code: string) {
  const response = await fetch(`${GITHUB_WEB}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GITHUB_APP_CLIENT_ID"),
      client_secret: requiredEnv("GITHUB_APP_CLIENT_SECRET"),
      code,
      redirect_uri: callbackUrl(),
    }),
  });
  const payload = await response.json().catch(() => ({})) as TokenResponse;
  if (!response.ok || payload.error || !payload.access_token) {
    throw githubError(payload.error_description || "GitHub authorization could not be completed.", 400);
  }
  return payload;
}

async function refreshUserToken(refreshToken: string) {
  const response = await fetch(`${GITHUB_WEB}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GITHUB_APP_CLIENT_ID"),
      client_secret: requiredEnv("GITHUB_APP_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const payload = await response.json().catch(() => ({})) as TokenResponse;
  if (!response.ok || payload.error || !payload.access_token) {
    throw githubError("Your GitHub connection expired. Reconnect GitHub.", 401);
  }
  return payload;
}

async function optionalUserToken(userId: string): Promise<string | null> {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection?.accessTokenEncrypted) return null;

  const expiresSoon = connection.tokenExpiresAt
    ? connection.tokenExpiresAt.getTime() <= Date.now() + 60_000
    : false;
  if (!expiresSoon) return decryptSecret(connection.accessTokenEncrypted);
  if (!connection.refreshTokenEncrypted) return null;

  const refreshed = await refreshUserToken(decryptSecret(connection.refreshTokenEncrypted));
  await prisma.gitHubConnection.update({
    where: { userId },
    data: {
      accessTokenEncrypted: encryptSecret(refreshed.access_token!),
      refreshTokenEncrypted: refreshed.refresh_token
        ? encryptSecret(refreshed.refresh_token)
        : connection.refreshTokenEncrypted,
      tokenExpiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
      refreshTokenExpiresAt: refreshed.refresh_token_expires_in
        ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)
        : connection.refreshTokenExpiresAt,
    },
  });
  return refreshed.access_token!;
}

async function fetchUserInstallations(userId: string): Promise<GitHubInstallation[]> {
  const token = await optionalUserToken(userId);
  if (!token) throw githubError("Connect GitHub before granting repository access.", 401);

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}/user/installations?per_page=100`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "DevArena-Language-Reader",
      },
    });
  } catch {
    throw githubError("GitHub installation access could not be checked. Try again.", 503);
  }

  const payload = await response.json().catch(() => ({})) as GitHubInstallationsResponse & GitHubApiErrorBody;
  if (!response.ok) {
    if (response.status === 401) throw githubError("Your GitHub connection expired. Reconnect GitHub.", 401);
    throw githubError(payload.message || "GitHub App installation access could not be checked.", response.status);
  }

  return Array.isArray(payload.installations) ? payload.installations : [];
}

async function syncUserInstallations(userId: string): Promise<GitHubInstallation[]> {
  const installations = await fetchUserInstallations(userId);
  const now = new Date();
  const installationIds = installations.map((installation) => String(installation.id));

  await prisma.$transaction(async (tx) => {
    for (const installation of installations) {
      await tx.gitHubInstallationAccess.upsert({
        where: {
          userId_installationId: {
            userId,
            installationId: String(installation.id),
          },
        },
        create: {
          userId,
          installationId: String(installation.id),
          accountId: null,
          accountLogin: null,
          accountType: null,
          repositorySelection: installation.repository_selection || null,
          permissions: Prisma.DbNull,
          events: Prisma.DbNull,
          lastSyncedAt: now,
        },
        update: {
          accountId: null,
          accountLogin: null,
          accountType: null,
          repositorySelection: installation.repository_selection || null,
          permissions: Prisma.DbNull,
          events: Prisma.DbNull,
          lastSyncedAt: now,
        },
      });
    }

    await tx.gitHubInstallationAccess.deleteMany({
      where: installationIds.length
        ? { userId, installationId: { notIn: installationIds } }
        : { userId },
    });
  });

  return installations;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function githubResponse(
  path: string,
  token?: string | null,
  acceptedStatuses: number[] = [],
) {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "DevArena-Verified-Tech-Stack",
      },
    });
  } catch {
    throw githubError("GitHub could not be reached. Check the server connection and try again.", 503);
  }

  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    const body = await response.json().catch(() => ({})) as GitHubApiErrorBody;
    if (response.status === 401) throw githubError("Your GitHub connection expired. Reconnect GitHub.", 401);
    if (response.status === 403) {
      if (response.headers.get("x-ratelimit-remaining") === "0") {
        throw githubError("GitHub API rate limit reached. Try again after the reset time.", 429);
      }
      throw githubError("GitHub denied access. Confirm that the App has Metadata and Contents read access for this repository.", 403);
    }
    if (response.status === 404) throw githubError("Repository not found or not accessible.", 404);
    throw githubError(body.message || `GitHub request failed with status ${response.status}.`, response.status);
  }
  return response;
}

async function githubLanguages(owner: string, repository: string, token?: string | null) {
  const response = await githubResponse(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/languages`, token);
  return response.json() as Promise<Record<string, number>>;
}

async function githubRepository(owner: string, repository: string, token?: string | null) {
  const response = await githubResponse(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, token);
  return response.json() as Promise<GitHubRepositoryMetadata>;
}

async function githubContributorStats(owner: string, repository: string, token: string) {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/stats/contributors`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await githubResponse(path, token, [202, 204]);
    if (response.status === 202) {
      await wait(500 + attempt * 500);
      continue;
    }
    if (response.status === 204) return [] as GitHubContributorStats[];
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload as GitHubContributorStats[] : [];
  }
  return null;
}

async function fallbackCommitEvidence(owner: string, repository: string, token: string, githubLogin: string) {
  const shas: string[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const response = await githubResponse(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits?author=${encodeURIComponent(githubLogin)}&per_page=100&page=${page}`,
      token,
    );
    const payload = await response.json().catch(() => []);
    if (!Array.isArray(payload)) break;
    for (const item of payload) {
      if (item && typeof item === "object" && "sha" in item && typeof item.sha === "string") shas.push(item.sha);
    }
    if (payload.length < 100) break;
  }

  const sampleLimit = Math.max(1, Math.min(40, Math.round(configuredNumber("GITHUB_CONTRIBUTION_COMMIT_SAMPLE", 20))));
  const sample = shas.slice(0, sampleLimit);
  let additions = 0;
  let deletions = 0;
  for (let index = 0; index < sample.length; index += 5) {
    const details = await Promise.all(sample.slice(index, index + 5).map(async (sha) => {
      const response = await githubResponse(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits/${encodeURIComponent(sha)}`,
        token,
      );
      return response.json().catch(() => ({})) as Promise<{ stats?: { additions?: number; deletions?: number } }>;
    }));
    additions += details.reduce((sum, item) => sum + (Number(item.stats?.additions) || 0), 0);
    deletions += details.reduce((sum, item) => sum + (Number(item.stats?.deletions) || 0), 0);
  }

  if (sample.length > 0 && shas.length > sample.length) {
    const scale = shas.length / sample.length;
    additions = Math.round(additions * scale);
    deletions = Math.round(deletions * scale);
  }
  return { available: shas.length > 0, userCommits: shas.length, additions, deletions };
}

async function contributionEvidence(
  repository: GitHubRepositoryMetadata,
  token: string | null,
  githubUserId: string | null,
  githubLogin: string | null,
): Promise<ContributionEvidence> {
  if (!token || !githubLogin) {
    return {
      status: "GITHUB_DISCONNECTED",
      eligible: false,
      reason: "Connect GitHub to verify that this repository contains your own or collaborative work.",
      permission: "none",
      roleName: repository.role_name || null,
      userCommits: 0,
      repositoryCommits: 0,
      additions: 0,
      deletions: 0,
      contributionPercent: 0,
      contributionWeight: 0,
    };
  }

  const permission = permissionFromRepository(repository, githubLogin);
  const owner = repository.owner.login.toLowerCase() === githubLogin.toLowerCase();
  if (!owner && !hasWritePermission(permission)) {
    return {
      status: "READ_ONLY_ACCESS",
      eligible: false,
      reason: "The connected GitHub account needs write, maintain, or admin access for this project to affect the Tech Stack.",
      permission,
      roleName: repository.role_name || null,
      userCommits: 0,
      repositoryCommits: 0,
      additions: 0,
      deletions: 0,
      contributionPercent: 0,
      contributionWeight: 0,
    };
  }

  let statsAvailable = false;
  let userCommits = 0;
  let repositoryCommits = 0;
  let additions = 0;
  let deletions = 0;
  let commitShare = 0;
  let changeShare = 0;

  try {
    const stats = await githubContributorStats(repository.owner.login, repository.name, token);
    if (stats) {
      statsAvailable = true;
      repositoryCommits = stats.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const repositoryChanges = stats.reduce((sum, item) => sum + (item.weeks || []).reduce(
        (weekSum, week) => weekSum + (Number(week.a) || 0) + (Number(week.d) || 0), 0,
      ), 0);
      const mine = stats.find((item) => {
        const idMatches = githubUserId && item.author?.id !== undefined && String(item.author.id) === githubUserId;
        const loginMatches = item.author?.login?.toLowerCase() === githubLogin.toLowerCase();
        return Boolean(idMatches || loginMatches);
      });
      userCommits = Number(mine?.total) || 0;
      additions = (mine?.weeks || []).reduce((sum, week) => sum + (Number(week.a) || 0), 0);
      deletions = (mine?.weeks || []).reduce((sum, week) => sum + (Number(week.d) || 0), 0);
      commitShare = repositoryCommits > 0 ? userCommits / repositoryCommits : 0;
      changeShare = repositoryChanges > 0 ? (additions + deletions) / repositoryChanges : 0;
    }
  } catch {
    statsAvailable = false;
  }

  if (!statsAvailable || userCommits === 0) {
    try {
      const fallback = await fallbackCommitEvidence(repository.owner.login, repository.name, token, githubLogin);
      if (fallback.available) {
        userCommits = Math.max(userCommits, fallback.userCommits);
        additions = Math.max(additions, fallback.additions);
        deletions = Math.max(deletions, fallback.deletions);
      }
    } catch {
      // The project remains valid, but stays outside Top Tech Stack until
      // contribution evidence can be read.
    }
  }

  const thresholds = contributionThresholds();
  const changedLines = additions + deletions;
  const meaningful = userCommits >= thresholds.minCommits && changedLines >= thresholds.minChangedLines;
  const dominant = commitShare >= thresholds.minCommitShare || changeShare >= thresholds.minChangeShare;
  const ownerEvidence = owner && userCommits >= thresholds.ownerMinCommits && changedLines >= thresholds.ownerMinChangedLines;
  const eligible = repository.fork ? meaningful || dominant : owner ? ownerEvidence || meaningful || dominant : meaningful || dominant;
  const strongestShare = Math.max(commitShare, changeShare);
  const contributionWeight = !eligible
    ? 0
    : strongestShare >= 0.6
      ? 1
      : strongestShare > 0
        ? Number(Math.max(0.2, Math.min(0.85, strongestShare)).toFixed(4))
        : repository.fork
          ? 0.35
          : owner
            ? 0.75
            : 0.5;
  const contributionPercent = Number((strongestShare * 100).toFixed(2));

  if (!eligible) {
    return {
      status: statsAvailable || userCommits > 0 ? "INSUFFICIENT_CONTRIBUTION" : "CONTRIBUTION_UNAVAILABLE",
      eligible: false,
      reason: statsAvailable || userCommits > 0
        ? `Contribution evidence is below the current minimum of ${thresholds.minCommits} commits and ${thresholds.minChangedLines} changed lines.`
        : "GitHub could not verify contribution evidence. Ensure the App has Contents: read-only and your commit email is linked to GitHub.",
      permission,
      roleName: repository.role_name || null,
      userCommits,
      repositoryCommits,
      additions,
      deletions,
      contributionPercent,
      contributionWeight: 0,
    };
  }

  return {
    status: repository.fork ? "ELIGIBLE_SUBSTANTIAL_FORK" : owner ? "ELIGIBLE_ORIGINAL" : "ELIGIBLE_COLLABORATIVE",
    eligible: true,
    reason: repository.fork
      ? "Verified substantial work in a forked repository."
      : owner
        ? "Verified original repository work by the connected GitHub account."
        : "Verified write-level collaboration with meaningful contribution evidence.",
    permission,
    roleName: repository.role_name || null,
    userCommits,
    repositoryCommits,
    additions,
    deletions,
    contributionPercent,
    contributionWeight,
  };
}

async function fetchLanguageEvidence(userId: string, repositoryUrl: unknown): Promise<VerifiedGitHubRepository> {
  const parsed = parseRepositoryUrl(repositoryUrl);
  const connection = await prisma.gitHubConnection.findUnique({
    where: { userId },
    select: { githubUserId: true, githubLogin: true, accessTokenEncrypted: true },
  });
  const token = connection?.accessTokenEncrypted ? await optionalUserToken(userId).catch(() => null) : null;

  let repository: GitHubRepositoryMetadata | null = null;
  let rawLanguages: Record<string, number> | null = null;
  let authenticatedError: unknown = null;

  if (token) {
    try {
      [repository, rawLanguages] = await Promise.all([
        githubRepository(parsed.owner, parsed.repository, token),
        githubLanguages(parsed.owner, parsed.repository, token),
      ]);
    } catch (error) {
      authenticatedError = error;
    }
  }

  if (!repository || !rawLanguages) {
    try {
      [repository, rawLanguages] = await Promise.all([
        githubRepository(parsed.owner, parsed.repository, null),
        githubLanguages(parsed.owner, parsed.repository, null),
      ]);
    } catch (publicError) {
      const publicStatus = errorStatus(publicError);
      const authenticatedStatus = errorStatus(authenticatedError);
      if (publicStatus === 404 && (!token || authenticatedStatus === 404 || authenticatedStatus === 401)) {
        throw githubError(
          "Repository not found. For a private repository, connect GitHub and include it in the DevArena GitHub App installation.",
          404,
        );
      }
      throw authenticatedError || publicError;
    }
  }

  const contribution = await contributionEvidence(
    repository,
    token,
    connection?.githubUserId || null,
    connection?.githubLogin || null,
  );
  const verifiedAt = new Date();
  return {
    url: repository.html_url || parsed.normalizedUrl,
    fullName: repository.full_name || parsed.fullName,
    languages: languageBreakdown(rawLanguages),
    languageBytes: rawLanguages,
    verifiedAt,
    repository,
    contribution,
  };
}

function projectDataFromEvidence(verified: VerifiedGitHubRepository) {
  const { repository, contribution } = verified;
  return {
    githubRepositoryUrl: verified.url,
    githubRepositoryId: String(repository.id),
    githubRepositoryNodeId: repository.node_id || null,
    githubOwnerId: repository.owner.id === undefined ? null : String(repository.owner.id),
    githubRepositoryOwner: repository.owner.login,
    githubRepositoryName: repository.name,
    githubRepositoryFullName: repository.full_name,
    githubRepositoryPrivate: repository.private,
    githubVisibility: repository.visibility || (repository.private ? "private" : "public"),
    githubRepositoryDefaultBranch: repository.default_branch || null,
    githubInstallationId: null,
    githubPermission: contribution.permission,
    githubRoleName: contribution.roleName,
    githubLanguages: verified.languages,
    githubLanguageBytes: verified.languageBytes,
    githubLanguagesFetchedAt: verified.verifiedAt,
    githubTechnologyStack: Prisma.DbNull,
    githubTechnologyFetchedAt: null,
    githubTechnologyStatus: null,
    githubLastPushedAt: repository.pushed_at ? new Date(repository.pushed_at) : null,
    githubRepositorySizeKb: Number.isFinite(repository.size) ? Math.max(0, Number(repository.size)) : null,
    githubSourceBytes: Object.values(verified.languageBytes).reduce((sum, bytes) => sum + (Number(bytes) || 0), 0),
    githubVerifiedAt: verified.verifiedAt,
    githubLastCheckedAt: verified.verifiedAt,
    githubAccessStatus: "VERIFIED",
    githubIsFork: repository.fork,
    githubParentFullName: repository.parent?.full_name || null,
    githubContributionStatus: contribution.status,
    githubContributorCommits: contribution.userCommits,
    githubRepositoryCommits: contribution.repositoryCommits,
    githubUserAdditions: contribution.additions,
    githubUserDeletions: contribution.deletions,
    githubContributionPercent: contribution.contributionPercent,
    githubContributionWeight: contribution.contributionWeight,
    githubContributionVerifiedAt: verified.verifiedAt,
    githubEligibleForTechStack: contribution.eligible,
    githubEligibilityReason: contribution.reason,
    githubVerificationVersion: CONTRIBUTION_VERIFICATION_VERSION,
  };
}

function tournamentAutomatedScore(input: {
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

export const githubService = {
  configStatus() {
    return integrationConfigStatus();
  },

  async startConnection(userId: string) {
    requiredEnv("GITHUB_APP_CLIENT_ID");
    requiredEnv("GITHUB_APP_CLIENT_SECRET");
    const state = randomBytes(32).toString("base64url");
    await prisma.gitHubConnection.upsert({
      where: { userId },
      update: {
        oauthStateHash: stateHash(state),
        oauthStateExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      create: {
        userId,
        oauthStateHash: stateHash(state),
        oauthStateExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const authorize = new URL(`${GITHUB_WEB}/login/oauth/authorize`);
    authorize.searchParams.set("client_id", requiredEnv("GITHUB_APP_CLIENT_ID"));
    authorize.searchParams.set("redirect_uri", callbackUrl());
    authorize.searchParams.set("state", state);
    return { authorizationUrl: authorize.toString() };
  },

  async startInstallation(userId: string) {
    const base = installUrl();
    if (!base) throw githubError("GITHUB_APP_SLUG is missing.", 503);
    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    if (!connection?.accessTokenEncrypted) throw githubError("Connect GitHub before installing the GitHub App.", 400);
    const state = randomBytes(32).toString("base64url");
    await prisma.gitHubConnection.update({
      where: { userId },
      data: {
        installStateHash: stateHash(state),
        installStateExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const target = new URL(base);
    target.searchParams.set("state", state);
    return { installationUrl: target.toString() };
  },

  async completeConnection(code: string, state: string) {
    if (!code || !state) throw githubError("GitHub did not return a valid authorization response.");
    const connection = await prisma.gitHubConnection.findFirst({
      where: { oauthStateHash: stateHash(state), oauthStateExpiresAt: { gt: new Date() } },
    });
    if (!connection) throw githubError("GitHub authorization expired or the state was invalid.", 400);

    const token = await exchangeAuthorizationCode(code);
    const userResponse = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token.access_token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "DevArena-Language-Reader",
      },
    });
    const githubUser = await userResponse.json().catch(() => ({})) as { id?: number; login?: string };
    if (!userResponse.ok || !githubUser.id || !githubUser.login) {
      throw githubError("GitHub account details could not be loaded.", userResponse.status || 400);
    }

    await prisma.gitHubConnection.update({
      where: { id: connection.id },
      data: {
        githubUserId: String(githubUser.id),
        githubLogin: githubUser.login,
        accessTokenEncrypted: encryptSecret(token.access_token!),
        refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        refreshTokenExpiresAt: token.refresh_token_expires_in
          ? new Date(Date.now() + token.refresh_token_expires_in * 1000)
          : null,
        oauthStateHash: null,
        oauthStateExpiresAt: null,
        connectedAt: new Date(),
      },
    });
    void githubService.reverifyUserRepositories(connection.userId).catch(() => undefined);
    return connection.userId;
  },

  async completeInstallation(state: string, installationId: string) {
    if (!state || !/^\d+$/.test(installationId)) {
      throw githubError("GitHub installation setup did not return a valid installation.", 400);
    }
    const connection = await prisma.gitHubConnection.findFirst({
      where: { installStateHash: stateHash(state), installStateExpiresAt: { gt: new Date() } },
    });
    if (!connection) throw githubError("GitHub installation setup expired. Return to DevArena and try again.", 400);

    let matched = false;
    for (let attempt = 0; attempt < 3 && !matched; attempt += 1) {
      const installations = await syncUserInstallations(connection.userId);
      matched = installations.some((installation) => String(installation.id) === installationId);
      if (!matched && attempt < 2) await wait(450);
    }

    if (!matched) {
      throw githubError("The selected GitHub App installation is not available to this connected GitHub account.", 403);
    }

    await prisma.gitHubConnection.update({
      where: { id: connection.id },
      data: { installStateHash: null, installStateExpiresAt: null },
    });
    void githubService.reverifyUserRepositories(connection.userId).catch(() => undefined);
    return connection.userId;
  },

  async requiresMandatoryInstallation(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingRequired: true },
    });
    return Boolean(user?.onboardingRequired);
  },

  async userIdForState(state: string, mode: "authorization" | "installation") {
    if (!state) return null;
    const hash = stateHash(state);
    const connection = await prisma.gitHubConnection.findFirst({
      where: mode === "authorization"
        ? { oauthStateHash: hash }
        : { installStateHash: hash },
      select: { userId: true },
    });
    return connection?.userId || null;
  },

  async callbackRedirect(
    userId: string | null,
    success: boolean,
    message?: string,
    mode: "authorization" | "installation" = "authorization",
  ) {
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { onboardingRequired: true } })
      : null;
    const target = new URL(user?.onboardingRequired ? "/choose-username" : "/settings", `${frontendUrl()}/`);
    target.searchParams.set("github", success ? (mode === "installation" ? "installed" : "connected") : "error");
    if (message) target.searchParams.set("message", message.slice(0, 180));
    return target.toString();
  },

  async getStatus(userId: string) {
    const connection = await prisma.gitHubConnection.findUnique({
      where: { userId },
      select: { githubLogin: true, connectedAt: true, accessTokenEncrypted: true },
    });
    const config = integrationConfigStatus();
    let accessError: string | null = null;

    if (connection?.accessTokenEncrypted) {
      try {
        await syncUserInstallations(userId);
      } catch (error) {
        accessError = error instanceof Error ? error.message : "GitHub installation access could not be checked.";
      }
    }

    const installations = await prisma.gitHubInstallationAccess.findMany({
      where: { userId },
      select: { repositorySelection: true },
    });

    return {
      connected: Boolean(connection?.accessTokenEncrypted),
      githubLogin: connection?.githubLogin || null,
      connectedAt: connection?.connectedAt || null,
      repositoryCount: 0,
      installationCount: installations.length,
      privateRepositoryAccess: installations.length > 0,
      repositorySelections: installations
        .map((installation) => installation.repositorySelection)
        .filter((selection): selection is string => Boolean(selection)),
      configReady: config.ready,
      missingConfiguration: config.missing,
      callbackUrl: config.callbackUrl,
      setupUrl: config.setupUrl,
      webhookUrl: config.webhookUrl,
      accessError,
      technologyPermissionRequired: 1,
    };
  },

  async listRepositories(_userId: string) {
    // Repository listing is intentionally disabled. DevArena only reads the
    // language endpoint for the exact repository URL entered by the user.
    return [];
  },

  async verifyRepositoryForUser(userId: string, repositoryUrl: unknown) {
    return fetchLanguageEvidence(userId, repositoryUrl);
  },

  async getTournamentRepositorySnapshot(userId: string, repositoryUrl: unknown): Promise<TournamentRepositorySnapshot> {
    const verified = await fetchLanguageEvidence(userId, repositoryUrl);
    const parsed = parseRepositoryUrl(repositoryUrl);
    const token = await optionalUserToken(userId).catch(() => null);
    let headSha: string | null = null;
    try {
      const branch = verified.repository.default_branch || "main";
      const response = await githubResponse(
        `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/commits/${encodeURIComponent(branch)}`,
        token,
      );
      const payload = await response.json().catch(() => ({})) as { sha?: string };
      headSha = typeof payload.sha === "string" ? payload.sha : null;
    } catch {
      // Language and contribution evidence remain usable when a head SHA cannot be read.
    }
    return {
      url: verified.url,
      repositoryId: String(verified.repository.id),
      fullName: verified.fullName,
      isPrivate: verified.repository.private,
      headSha,
      sourceBytes: Object.values(verified.languageBytes).reduce((sum, value) => sum + (Number(value) || 0), 0),
      repositorySizeKb: Math.max(0, Number(verified.repository.size) || 0),
      pushedAt: verified.repository.pushed_at ? new Date(verified.repository.pushed_at) : null,
      languages: verified.languages,
      languageBytes: verified.languageBytes,
      contributionStatus: verified.contribution.status,
      contributionWeight: verified.contribution.contributionWeight,
      eligible: verified.contribution.eligible,
      verifiedAt: verified.verifiedAt,
    };
  },

  toClientVerifiedRepository(verified: VerifiedGitHubRepository) {
    return {
      url: verified.url,
      fullName: verified.fullName,
      languages: verified.languages,
      verifiedAt: verified.verifiedAt,
      techStackEligible: verified.contribution.eligible,
      contributionStatus: verified.contribution.status,
      eligibilityReason: verified.contribution.reason,
      isFork: verified.repository.fork,
    };
  },

  async reverifyProjectRepository(userId: string, project: {
    id: string;
    githubRepositoryUrl: string | null;
  }, rebuildStack = true) {
    if (!project.githubRepositoryUrl) return null;
    try {
      const verified = await fetchLanguageEvidence(userId, project.githubRepositoryUrl);
      await prisma.$transaction(async (tx) => {
        await tx.project.update({ where: { id: project.id }, data: projectDataFromEvidence(verified) });
        await rebuildProjectScoreEvents(tx, userId, project.id, rebuildStack);
      });
      if (rebuildStack) await techStackService.rebuildUserTopTechStack(userId);
      return verified;
    } catch (error) {
      const status = errorStatus(error);
      if (status === 401 || status === 403 || status === 404) {
        await prisma.$transaction(async (tx) => {
          await tx.project.update({
            where: { id: project.id },
            data: {
              githubLastCheckedAt: new Date(),
              githubAccessStatus: status === 404 ? "REPOSITORY_NOT_FOUND" : "ACCESS_LOST",
              githubEligibleForTechStack: false,
              githubContributionStatus: status === 404 ? "REPOSITORY_NOT_FOUND" : "ACCESS_LOST",
              githubEligibilityReason: error instanceof Error ? error.message : "GitHub access could not be verified.",
              githubContributionWeight: 0,
            },
          });
          await rebuildProjectScoreEvents(tx, userId, project.id, rebuildStack);
        }).catch(() => undefined);
        if (rebuildStack) await techStackService.rebuildUserTopTechStack(userId).catch(() => undefined);
      }
      throw error;
    }
  },

  async reverifyUserRepositories(userId: string) {
    const projects = await prisma.project.findMany({
      where: { userId, githubRepositoryUrl: { not: null } },
      select: { id: true, githubRepositoryUrl: true },
    });
    const outcomes = await Promise.allSettled(
      projects.map((project) => githubService.reverifyProjectRepository(userId, project, false)),
    );
    await prisma.$transaction((tx) => rebuildUserScoreState(tx, userId));
    await techStackService.rebuildUserTopTechStack(userId);
    return {
      checked: projects.length,
      verified: outcomes.filter((result) => result.status === "fulfilled").length,
      failed: outcomes.filter((result) => result.status === "rejected").length,
    };
  },

  async refreshStaleProjects(userId: string) {
    const configured = Number(process.env.GITHUB_REVERIFY_HOURS || DEFAULT_REVERIFY_HOURS);
    const hours = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REVERIFY_HOURS;
    const staleBefore = new Date(Date.now() - hours * 60 * 60 * 1000);
    const projects = await prisma.project.findMany({
      where: {
        userId,
        githubRepositoryUrl: { not: null },
        OR: [
          { githubLanguagesFetchedAt: null },
          { githubLanguagesFetchedAt: { lt: staleBefore } },
          { githubContributionVerifiedAt: null },
          { githubVerificationVersion: { not: CONTRIBUTION_VERIFICATION_VERSION } },
        ],
      },
      orderBy: { githubLanguagesFetchedAt: "asc" },
      take: 5,
      select: { id: true, githubRepositoryUrl: true },
    });
    await Promise.allSettled(projects.map((project) => githubService.reverifyProjectRepository(userId, project, false)));
    if (projects.length > 0) {
      await prisma.$transaction((tx) => rebuildUserScoreState(tx, userId));
      await techStackService.rebuildUserTopTechStack(userId);
    }
  },

  async runScheduledRechecks() {
    const configured = Number(process.env.GITHUB_REVERIFY_HOURS || DEFAULT_REVERIFY_HOURS);
    const hours = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REVERIFY_HOURS;
    const staleBefore = new Date(Date.now() - hours * 60 * 60 * 1000);
    const owners = await prisma.project.findMany({
      where: {
        githubRepositoryUrl: { not: null },
        OR: [
          { githubLanguagesFetchedAt: null },
          { githubLanguagesFetchedAt: { lt: staleBefore } },
          { githubContributionVerifiedAt: null },
          { githubVerificationVersion: { not: CONTRIBUTION_VERIFICATION_VERSION } },
        ],
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 20,
    });
    const results = await Promise.allSettled(owners.map((owner) => githubService.refreshStaleProjects(owner.userId)));
    return {
      ownersChecked: owners.length,
      succeeded: results.filter((result) => result.status === "fulfilled").length,
      failed: results.filter((result) => result.status === "rejected").length,
    };
  },

  projectData(verified: VerifiedGitHubRepository) {
    return projectDataFromEvidence(verified);
  },

  topTechStack(userId: string) {
    return techStackService.getUserTopTechStack(userId);
  },

  rebuildTopTechStack(userId: string) {
    return techStackService.rebuildUserTopTechStack(userId);
  },

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (!secret || !signature?.startsWith("sha256=")) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    return left.length === right.length && timingSafeEqual(left, right);
  },

  async handleWebhook(event: string, payload: Record<string, unknown>, deliveryId: string) {
    if (!deliveryId.trim()) throw githubError("GitHub delivery ID is missing.", 400);
    const action = typeof payload.action === "string" ? payload.action : null;
    try {
      await prisma.gitHubWebhookDelivery.create({ data: { deliveryId, event, action } });
    } catch (reason) {
      if (reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === "P2002") {
        return { handled: true, duplicate: true, event, queued: 0 };
      }
      throw reason;
    }

    const repository = payload.repository as { id?: number; html_url?: string } | undefined;
    const installation = payload.installation as { id?: number } | undefined;
    const added = Array.isArray(payload.repositories_added) ? payload.repositories_added as Array<{ id?: number; html_url?: string }> : [];
    const removed = Array.isArray(payload.repositories_removed) ? payload.repositories_removed as Array<{ id?: number; html_url?: string }> : [];
    let projects: Array<{ id: string; userId: string; githubRepositoryId: string | null; githubRepositoryUrl: string | null }> = [];
    let tournamentSubmissions: Array<{ id: string; userId: string | null; repositoryId: string | null; repositoryUrl: string; teamId: string | null }> = [];

    if (event === "installation" && installation?.id !== undefined) {
      const installationId = String(installation.id);
      const accesses = await prisma.gitHubInstallationAccess.findMany({ where: { installationId }, select: { userId: true } });
      const users = [...new Set(accesses.map((item) => item.userId))];
      projects = await prisma.project.findMany({
        where: { userId: { in: users }, githubRepositoryUrl: { not: null } },
        select: { id: true, userId: true, githubRepositoryId: true, githubRepositoryUrl: true },
      });
      tournamentSubmissions = await prisma.projectTournamentSubmission.findMany({
        where: { userId: { in: users } },
        select: { id: true, userId: true, repositoryId: true, repositoryUrl: true, teamId: true },
      });
      if (action === "deleted") await prisma.gitHubInstallationAccess.deleteMany({ where: { installationId } });
    } else {
      const refs = [repository, ...added, ...removed].filter((item): item is { id?: number; html_url?: string } => Boolean(item?.id !== undefined || item?.html_url));
      const ids = refs.flatMap((item) => item.id === undefined ? [] : [String(item.id)]);
      const urls = refs.flatMap((item) => item.html_url ? [item.html_url] : []);
      if (ids.length || urls.length) {
        const repositoryWhere: Prisma.ProjectWhereInput = {
          OR: [
            ...(ids.length ? [{ githubRepositoryId: { in: ids } }] : []),
            ...(urls.length ? [{ githubRepositoryUrl: { in: urls } }] : []),
          ],
        };
        projects = await prisma.project.findMany({
          where: repositoryWhere,
          select: { id: true, userId: true, githubRepositoryId: true, githubRepositoryUrl: true },
        });
        tournamentSubmissions = await prisma.projectTournamentSubmission.findMany({
          where: {
            OR: [
              ...(ids.length ? [{ repositoryId: { in: ids } }] : []),
              ...(urls.length ? [{ repositoryUrl: { in: urls } }] : []),
            ],
          },
          select: { id: true, userId: true, repositoryId: true, repositoryUrl: true, teamId: true },
        });
      }
    }

    const removedIds = new Set(removed.flatMap((item) => item.id === undefined ? [] : [String(item.id)]));
    const removedUrls = new Set(removed.flatMap((item) => item.html_url ? [item.html_url] : []));
    const permanentRemoval = event === "repository" && (action === "deleted" || action === "archived");
    let queued = 0;
    for (const project of projects) {
      const accessRemoved = permanentRemoval || action === "deleted" || action === "suspend"
        || removedIds.has(project.githubRepositoryId || "") || removedUrls.has(project.githubRepositoryUrl || "");
      if (accessRemoved) {
        await prisma.$transaction(async (tx) => {
          await tx.project.update({
            where: { id: project.id },
            data: {
              githubAccessStatus: permanentRemoval ? "REPOSITORY_NOT_FOUND" : "ACCESS_LOST",
              githubContributionStatus: permanentRemoval ? "REPOSITORY_NOT_FOUND" : "ACCESS_LOST",
              githubEligibleForTechStack: false,
              githubContributionWeight: 0,
              githubEligibilityReason: permanentRemoval ? "The GitHub repository is no longer available." : "GitHub App access was removed or suspended.",
              githubLastCheckedAt: new Date(),
            },
          });
          await rebuildProjectScoreEvents(tx, project.userId, project.id);
        });
        await techStackService.rebuildUserTopTechStack(project.userId);
        continue;
      }
      const dueAt = new Date(Date.now() + (event === "push" ? 2 * 60_000 : 5_000));
      await prisma.gitHubProjectRefreshJob.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, reason: `${event}${action ? `:${action}` : ""}`, dueAt },
        update: { reason: `${event}${action ? `:${action}` : ""}`, dueAt, lockedAt: null, lastError: null },
      });
      queued += 1;
    }
    for (const submission of tournamentSubmissions) {
      const accessRemoved = permanentRemoval || action === "deleted" || action === "suspend"
        || removedIds.has(submission.repositoryId || "") || removedUrls.has(submission.repositoryUrl || "");
      if (accessRemoved) {
        await prisma.projectTournamentSubmission.update({
          where: { id: submission.id },
          data: {
            contributionStatus: permanentRemoval ? "REPOSITORY_NOT_FOUND" : "ACCESS_LOST",
            contributionWeight: 0,
            status: "Under_Review",
            adminNotes: permanentRemoval
              ? "The connected GitHub repository is no longer available."
              : "GitHub App access was removed or suspended. Restore access before final judging.",
            lastGithubRefreshAt: new Date(),
          },
        });
        continue;
      }
      const dueAt = new Date(Date.now() + (event === "push" ? 2 * 60_000 : 5_000));
      await prisma.tournamentProjectRefreshJob.upsert({
        where: { submissionId: submission.id },
        create: { submissionId: submission.id, reason: `${event}${action ? `:${action}` : ""}`, dueAt },
        update: { reason: `${event}${action ? `:${action}` : ""}`, dueAt, lockedAt: null, lastError: null },
      });
      queued += 1;
    }
    await prisma.gitHubWebhookDelivery.update({ where: { deliveryId }, data: { status: "Queued", processedAt: new Date() } });
    return { handled: true, duplicate: false, event, queued };
  },

  async runPendingWebhookRefreshes() {
    const now = new Date();
    const lockExpired = new Date(Date.now() - 5 * 60_000);
    const jobs = await prisma.gitHubProjectRefreshJob.findMany({
      where: { dueAt: { lte: now }, OR: [{ lockedAt: null }, { lockedAt: { lt: lockExpired } }] },
      orderBy: { dueAt: "asc" },
      take: 10,
      include: { project: { select: { id: true, userId: true, githubRepositoryUrl: true } } },
    });
    let refreshed = 0;
    for (const job of jobs) {
      const locked = await prisma.gitHubProjectRefreshJob.updateMany({
        where: { id: job.id, OR: [{ lockedAt: null }, { lockedAt: { lt: lockExpired } }] },
        data: { lockedAt: now, attempts: { increment: 1 } },
      });
      if (!locked.count) continue;
      try {
        await githubService.reverifyProjectRepository(job.project.userId, job.project, true);
        await prisma.gitHubProjectRefreshJob.delete({ where: { id: job.id } });
        refreshed += 1;
      } catch (reason) {
        const attempts = job.attempts + 1;
        if (attempts >= 5) {
          await prisma.gitHubProjectRefreshJob.delete({ where: { id: job.id } });
        } else {
          await prisma.gitHubProjectRefreshJob.update({
            where: { id: job.id },
            data: {
              lockedAt: null,
              dueAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
              lastError: reason instanceof Error ? reason.message.slice(0, 2000) : String(reason).slice(0, 2000),
            },
          });
        }
      }
    }
    const tournamentJobs = await prisma.tournamentProjectRefreshJob.findMany({
      where: { dueAt: { lte: now }, OR: [{ lockedAt: null }, { lockedAt: { lt: lockExpired } }] },
      orderBy: { dueAt: "asc" },
      take: 10,
      include: { submission: true },
    });
    let tournamentRefreshed = 0;
    for (const job of tournamentJobs) {
      const locked = await prisma.tournamentProjectRefreshJob.updateMany({
        where: { id: job.id, OR: [{ lockedAt: null }, { lockedAt: { lt: lockExpired } }] },
        data: { lockedAt: now, attempts: { increment: 1 } },
      });
      if (!locked.count || !job.submission.userId) continue;
      try {
        const snapshot = await githubService.getTournamentRepositorySnapshot(job.submission.userId, job.submission.repositoryUrl);
        const automatedScore = tournamentAutomatedScore({
          baselineSourceBytes: job.submission.baselineSourceBytes,
          finalSourceBytes: snapshot.sourceBytes,
          baselineSizeKb: job.submission.baselineRepositorySizeKb,
          finalSizeKb: snapshot.repositorySizeKb,
          contributionWeight: snapshot.contributionWeight,
          deploymentUrl: job.submission.deploymentUrl,
          eligible: snapshot.eligible,
        });
        await prisma.projectTournamentSubmission.update({
          where: { id: job.submission.id },
          data: {
            repositoryId: snapshot.repositoryId,
            repositoryFullName: snapshot.fullName,
            repositoryPrivate: snapshot.isPrivate,
            finalCommitSha: snapshot.headSha,
            finalSourceBytes: snapshot.sourceBytes,
            finalRepositorySizeKb: snapshot.repositorySizeKb,
            languageBytes: snapshot.languageBytes,
            languages: snapshot.languages,
            contributionWeight: snapshot.contributionWeight,
            contributionStatus: snapshot.contributionStatus,
            automatedScore,
            finalScore: Number((automatedScore + job.submission.manualScore).toFixed(2)),
            lastGithubRefreshAt: snapshot.verifiedAt,
          },
        });
        const tournamentRecipients = await prisma.tournamentRegistration.findMany({
          where: { tournamentId: job.submission.tournamentId, status: { not: "Withdrawn" } },
          select: { userId: true },
        });
        await publishRealtimeEvents(tournamentRecipients.map((item) => item.userId), {
          type: "tournaments.github.changed",
          entityType: "Tournament",
          entityId: job.submission.tournamentId,
          payload: { submissionId: job.submission.id },
        });
        await prisma.tournamentProjectRefreshJob.delete({ where: { id: job.id } });
        tournamentRefreshed += 1;
      } catch (reason) {
        const attempts = job.attempts + 1;
        if (attempts >= 5) await prisma.tournamentProjectRefreshJob.delete({ where: { id: job.id } });
        else await prisma.tournamentProjectRefreshJob.update({
          where: { id: job.id },
          data: {
            lockedAt: null,
            dueAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
            lastError: reason instanceof Error ? reason.message.slice(0, 2000) : String(reason).slice(0, 2000),
          },
        });
      }
    }
    return { checked: jobs.length, refreshed, tournamentChecked: tournamentJobs.length, tournamentRefreshed };
  },

  async disconnect(userId: string) {
    await prisma.$transaction([
      prisma.project.updateMany({
        where: { userId, githubRepositoryUrl: { not: null } },
        data: {
          githubAccessStatus: "GITHUB_DISCONNECTED",
          githubContributionStatus: "GITHUB_DISCONNECTED",
          githubEligibleForTechStack: false,
          githubContributionWeight: 0,
          githubEligibilityReason: "Reconnect GitHub to verify this project for the live Tech Stack.",
          githubLastCheckedAt: new Date(),
        },
      }),
      prisma.gitHubAuthorizedRepository.deleteMany({ where: { userId } }),
      prisma.gitHubInstallationAccess.deleteMany({ where: { userId } }),
      prisma.gitHubConnection.deleteMany({ where: { userId } }),
    ]);
    await prisma.$transaction((tx) => rebuildProjectScoresForUser(tx, userId));
    await techStackService.rebuildUserTopTechStack(userId);
  },
};
