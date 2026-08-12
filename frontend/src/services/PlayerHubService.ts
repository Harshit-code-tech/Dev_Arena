import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";
import { getChatDeviceToken } from "./ChatDeviceStorageService";

export type TopTechStackItem = {
  name: string;
  percentage: number;
  projectCount: number;
};

export type HubPerson = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  useInitials: boolean;
  rank: string;
  arenaScore: number;
  topTechStack: TopTechStackItem[] | null;
  topTechStackUpdatedAt: string | null;
  topTechStackProjectCount: number;
  chatPublicKey?: JsonWebKey | null;
  chatKeyVersion?: number;
};

export type HubPlayer = HubPerson & {
  relationship: "none" | "friends" | "incoming" | "outgoing";
  blockedByMe: boolean;
  chatReady: boolean;
};

export type HubOverview = {
  playerCount: number;
  sharedProjectCount: number;
  collaborationCount: number;
  communityCount: number;
  unreadMessages: number;
};


export type PlayerWorkDsaLog = {
  id: string;
  problemName: string;
  url: string | null;
  solutionUrl: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  timeTaken: number;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  notes: string | null;
  activityDate: string;
  createdAt: string;
  points: number;
};

export type PlayerWorkProject = {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  status: string;
  startDate: string;
  shareSlug: string | null;
  sharedAt: string | null;
  updatedAt: string;
  repositoryUrl: string | null;
  languages: Array<{ name: string; percentage: number }> | null;
  languagesFetchedAt: string | null;
  metrics: {
    completedMilestones: number;
    totalMilestones: number;
    milestoneProgress: number;
    totalSessions: number;
    lastActivityDate: string;
  };
};

export type PlayerWork = {
  player: HubPerson & { activeDays: number; streak: number };
  dsa: { total: number; logs: PlayerWorkDsaLog[] };
  projects: { total: number; items: PlayerWorkProject[] };
};

export type SharedProject = {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  status: string;
  shareSlug: string | null;
  sharedAt: string | null;
  updatedAt: string;
  github: {
    languages: Array<{ name: string; percentage: number }> | null;
    languagesFetchedAt: string | null;
  } | null;
  owner: HubPerson;
  metrics: {
    completedMilestones: number;
    totalMilestones: number;
    milestoneProgress: number;
    totalSessions: number;
    lastActivityDate: string;
  };
  savedByMe: boolean;
  saveCount: number;
};

export type CollaborationPost = {
  id: string;
  authorId: string;
  author: HubPerson;
  title: string;
  description: string;
  type: string;
  domain: string;
  skills: string[];
  commitment: string;
  positions: number;
  deadline: string | null;
  status: "Open" | "Closed" | string;
  createdAt: string;
  updatedAt: string;
  appliedByMe: boolean;
  myApplicationStatus: string | null;
  applicationCount: number;
  isOwner: boolean;
};

export type CollaborationApplication = {
  id: string;
  postId: string;
  applicantId: string;
  introduction: string;
  availability: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  applicant: HubPerson;
};

export type CommunityComment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: HubPerson;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  author: HubPerson;
  type: string;
  title: string;
  content: string;
  codeSnippet: string | null;
  createdAt: string;
  updatedAt: string;
  comments: CommunityComment[];
  reactedByMe: boolean;
  savedByMe: boolean;
  reactionCount: number;
  saveCount: number;
  commentCount: number;
};

export type DirectConversation = {
  id: string;
  peer: HubPerson;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: { id: string; senderId: string; createdAt: string; deletedAt: string | null } | null;
};

export type EncryptedDirectMessage = {
  id: string;
  senderId: string;
  clientId?: string | null;
  ciphertext: string;
  iv: string;
  algorithm: "AES-GCM" | string;
  senderKeyVersion: number;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  clientState?: "encrypting" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  clientError?: string;
};

export type ChatAuthenticatorStatus = {
  configured: boolean;
  enabledAt: string | null;
  lastVerifiedAt: string | null;
  keyVersion: number | null;
  activeDeviceCount: number;
  currentDeviceRegistered: boolean;
};

export type ChatAuthenticatorSetup = {
  setupToken: string;
  setupKey: string;
  otpauthUri: string;
  accountLabel: string;
  expiresAt: string;
};

export type ChatAuthenticatorRestore = {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
  keyVersion: number;
};

export type ChatDeviceChallenge = {
  challengeToken: string;
  nonce: string;
  serverPublicKey: string;
  expiresAt: string;
};

export type ChatDevice = {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  current: boolean;
};

export type MatchingPreference = {
  goal: "Project teammate" | "DSA partner" | "Hackathon teammate" | "Mentor" | "Mentee" | "Open-source contributor";
  mode: "Balanced" | "Similar" | "Complementary";
  preferredDomain: "Any" | "Fullstack" | "App" | "AI" | "Other";
  weeklyAvailability: "Any" | "1-3 hours" | "4-7 hours" | "8-12 hours" | "12+ hours";
  experiencePreference: "Similar" | "More experienced" | "Less experienced" | "Any";
  discoveryEnabled: boolean;
};

export type MatchComponents = {
  tech: number;
  domain: number;
  goal: number;
  activity: number;
  dsa: number;
  experience: number;
  availability: number;
};

export type PlayerMatchRecommendation = {
  player: HubPerson;
  score: number;
  mode: MatchingPreference["mode"];
  goal: MatchingPreference["goal"];
  components: MatchComponents;
  reasons: string[];
};

export type MatchingEligibilityReason =
  | "ELIGIBLE"
  | "GITHUB_NOT_CONNECTED"
  | "INSUFFICIENT_VERIFIED_PROJECTS"
  | "TECH_STACK_NOT_READY";

export type MatchingEligibility = {
  eligible: boolean;
  reason: MatchingEligibilityReason;
  requiredProjects: number;
  verifiedProjects: number;
  githubConnected: boolean;
  techStackReady: boolean;
};

export type MatchingRecommendations = {
  modelVersion: string;
  preference: MatchingPreference;
  eligibility: MatchingEligibility;
  items: PlayerMatchRecommendation[];
};

export type BlockedPlayer = {
  id: string;
  player: HubPerson;
  createdAt: string;
};

type Envelope<T> = { success?: boolean; data: T; message?: string };

export class PlayerHubRequestError extends Error {
  status: number;
  code: "OFFLINE" | "SESSION" | "BLOCKED" | "DEVICE" | "TOO_LONG" | "RATE_LIMIT" | "SERVER" | "NETWORK" | "UNKNOWN";
  retryable: boolean;

  constructor(message: string, status = 0, code: PlayerHubRequestError["code"] = "UNKNOWN", retryable = false) {
    super(message);
    this.name = "PlayerHubRequestError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function token() {
  const value = getStoredAuthToken();
  if (!value) throw new Error("Your session has expired. Please sign in again.");
  return value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new PlayerHubRequestError("No internet connection. Your message will be sent when you reconnect.", 0, "OFFLINE", true);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        ...(getChatDeviceToken() ? { "X-DevArena-Chat-Device": getChatDeviceToken() } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new PlayerHubRequestError("Connection lost. DevArena will retry when the network returns.", 0, "NETWORK", true);
  }

  const payload = await response.json().catch(() => ({})) as Partial<Envelope<T>>;
  if (!response.ok) {
    const message = payload.message || "Player Hub request failed.";
    if (response.status === 401) throw new PlayerHubRequestError("Your session expired. Sign in again.", 401, "SESSION", false);
    if (response.status === 403) throw new PlayerHubRequestError(message || "This conversation is blocked.", 403, "BLOCKED", false);
    if (response.status === 428) throw new PlayerHubRequestError(message || "Restore secure chat on this browser.", 428, "DEVICE", false);
    if (response.status === 413) throw new PlayerHubRequestError("The message is too long.", 413, "TOO_LONG", false);
    if (response.status === 429) throw new PlayerHubRequestError("Message rate limit reached. Wait briefly and retry.", 429, "RATE_LIMIT", true);
    if (response.status >= 500) throw new PlayerHubRequestError("The server is temporarily unavailable. Your message remains queued.", response.status, "SERVER", true);
    throw new PlayerHubRequestError(message, response.status, "UNKNOWN", false);
  }
  return payload.data as T;
}

export const PlayerHubApi = {
  overview: () => request<HubOverview>("/api/player-hub/overview"),
  players: (query = "") => request<HubPlayer[]>(`/api/player-hub/players?q=${encodeURIComponent(query)}`),
  playerWork: (playerId: string) => request<PlayerWork>(`/api/player-hub/players/${encodeURIComponent(playerId)}/work`),
  projects: () => request<SharedProject[]>("/api/player-hub/projects"),
  saveProject: (projectId: string, saved: boolean) => request<{ saved: boolean }>(`/api/player-hub/projects/${encodeURIComponent(projectId)}/save`, { method: saved ? "POST" : "DELETE" }),
  collaborations: () => request<CollaborationPost[]>("/api/player-hub/collaborations"),
  createCollaboration: (input: Record<string, unknown>) => request<CollaborationPost>("/api/player-hub/collaborations", { method: "POST", body: JSON.stringify(input) }),
  applyCollaboration: (postId: string, input: Record<string, unknown>) => request(`/api/player-hub/collaborations/${encodeURIComponent(postId)}/apply`, { method: "POST", body: JSON.stringify(input) }),
  collaborationApplications: (postId: string) => request<CollaborationApplication[]>(`/api/player-hub/collaborations/${encodeURIComponent(postId)}/applications`),
  setCollaborationApplicationStatus: (postId: string, applicationId: string, status: string) => request(`/api/player-hub/collaborations/${encodeURIComponent(postId)}/applications/${encodeURIComponent(applicationId)}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  setCollaborationStatus: (postId: string, status: "Open" | "Closed") => request(`/api/player-hub/collaborations/${encodeURIComponent(postId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  community: () => request<CommunityPost[]>("/api/player-hub/community"),
  createCommunityPost: (input: Record<string, unknown>) => request<CommunityPost>("/api/player-hub/community", { method: "POST", body: JSON.stringify(input) }),
  reactCommunityPost: (postId: string, active: boolean) => request(`/api/player-hub/community/${encodeURIComponent(postId)}/reaction`, { method: "POST", body: JSON.stringify({ active }) }),
  saveCommunityPost: (postId: string, active: boolean) => request(`/api/player-hub/community/${encodeURIComponent(postId)}/save`, { method: "POST", body: JSON.stringify({ active }) }),
  commentCommunityPost: (postId: string, content: string) => request<CommunityComment>(`/api/player-hub/community/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  blocks: () => request<BlockedPlayer[]>("/api/player-hub/blocks"),
  blockPlayer: (playerId: string, blocked: boolean) => request(`/api/player-hub/blocks/${encodeURIComponent(playerId)}`, { method: blocked ? "POST" : "DELETE" }),
  report: (input: Record<string, unknown>) => request<{ id: string; status: string }>("/api/player-hub/reports", { method: "POST", body: JSON.stringify(input) }),
  getChatKey: () => request<{ chatPublicKey: JsonWebKey | null; chatKeyVersion: number }>("/api/player-hub/crypto/key"),
  saveChatKey: (publicKey: JsonWebKey) => request<{ chatPublicKey: JsonWebKey; chatKeyVersion: number }>("/api/player-hub/crypto/key", { method: "PUT", body: JSON.stringify({ publicKey }) }),
  chatDeviceChallenge: () => request<ChatDeviceChallenge>("/api/player-hub/crypto/devices/challenge", { method: "POST" }),
  registerChatDevice: (input: { deviceToken: string; deviceName: string; challengeToken: string; proof: string }) => request<ChatDevice>("/api/player-hub/crypto/devices/register", { method: "POST", body: JSON.stringify(input) }),
  chatDevices: () => request<ChatDevice[]>("/api/player-hub/crypto/devices"),
  revokeChatDevice: (deviceId: string) => request<{ id: string; revokedAt: string }>(`/api/player-hub/crypto/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" }),
  chatAuthenticatorStatus: () => request<ChatAuthenticatorStatus>("/api/player-hub/crypto/authenticator/status"),
  beginChatAuthenticatorSetup: () => request<ChatAuthenticatorSetup>("/api/player-hub/crypto/authenticator/setup", { method: "POST" }),
  confirmChatAuthenticatorSetup: (input: { setupToken: string; code: string; publicKey: JsonWebKey; privateKey: JsonWebKey; deviceToken: string; deviceName: string }) => request<{ configured: boolean; keyVersion: number }>("/api/player-hub/crypto/authenticator/setup/confirm", { method: "POST", body: JSON.stringify(input) }),
  restoreChatWithAuthenticator: (input: { code: string; deviceToken: string; deviceName: string }) => request<ChatAuthenticatorRestore>("/api/player-hub/crypto/authenticator/restore", { method: "POST", body: JSON.stringify(input) }),
  matchingPreferences: () => request<MatchingPreference>("/api/player-hub/matching/preferences"),
  updateMatchingPreferences: (input: MatchingPreference) => request<MatchingPreference>("/api/player-hub/matching/preferences", { method: "PUT", body: JSON.stringify(input) }),
  matchingRecommendations: () => request<MatchingRecommendations>("/api/player-hub/matching/recommendations"),
  matchingFeedback: (playerId: string, action: "Good match" | "Not relevant" | "Hide") => request<{ candidateId: string; action: string }>(`/api/player-hub/matching/${encodeURIComponent(playerId)}/feedback`, { method: "POST", body: JSON.stringify({ action }) }),
  conversations: () => request<DirectConversation[]>("/api/player-hub/conversations"),
  createConversation: (playerId: string) => request<DirectConversation>(`/api/player-hub/conversations/player/${encodeURIComponent(playerId)}`, { method: "POST" }),
  messages: (conversationId: string, before?: string) => request<EncryptedDirectMessage[]>(`/api/player-hub/conversations/${encodeURIComponent(conversationId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`),
  sendMessage: (conversationId: string, input: { clientId: string; ciphertext: string; iv: string; algorithm: string; senderKeyVersion: number }) => request<EncryptedDirectMessage>(`/api/player-hub/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify(input) }),
  setTyping: (conversationId: string, active: boolean) => request(`/api/player-hub/conversations/${encodeURIComponent(conversationId)}/typing`, { method: "POST", body: JSON.stringify({ active }) }),
  markDelivered: (conversationId: string) => request(`/api/player-hub/conversations/${encodeURIComponent(conversationId)}/delivered`, { method: "POST" }),
  markRead: (conversationId: string) => request(`/api/player-hub/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }),
  unread: () => request<number>("/api/player-hub/unread"),
};
