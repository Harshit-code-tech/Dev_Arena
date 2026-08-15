import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type FriendTopTechStackItem = {
  name: string;
  percentage: number;
  projectCount: number;
};

export type FriendPerson = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  useInitials: boolean;
  rank: string;
  arenaScore: number;
  topTechStack: FriendTopTechStackItem[];
  topTechStackUpdatedAt: string | null;
  topTechStackProjectCount: number;
};

export type FriendOverview = {
  friends: Array<{ friendshipId: string; friend: FriendPerson; friendsSince: string }>;
  incomingRequests: Array<{ id: string; user: FriendPerson; createdAt: string }>;
  outgoingRequests: Array<{ id: string; user: FriendPerson; createdAt: string }>;
  emailInvites: Array<{ id: string; email: string; createdAt: string; expiresAt: string; status: string }>;
};

export type FriendSearchResult = FriendPerson & {
  relationship: "none" | "friends" | "incoming" | "outgoing";
};

type Envelope<T> = { data: T; message?: string };

function authToken() {
  const value = getStoredAuthToken();
  if (!value) throw new Error("Your session has expired. Please sign in again.");
  return value;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${authToken()}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok) throw new Error(payload.message || "Player request failed.");
  return payload.data;
}

export function getFriendOverview() {
  return request<FriendOverview>("/api/friends");
}

export function searchDevelopers(query: string) {
  return request<FriendSearchResult[]>(`/api/friends/search?q=${encodeURIComponent(query)}`);
}

export function inviteFriendByEmail(email: string) {
  return request<{ type: string; message: string }>("/api/friends/invite", { method: "POST", body: JSON.stringify({ email }) });
}

export function sendFriendRequest(userId: string) {
  return request(`/api/friends/request/${encodeURIComponent(userId)}`, { method: "POST" });
}

export function acceptFriendRequest(requestId: string) {
  return request(`/api/friends/requests/${encodeURIComponent(requestId)}/accept`, { method: "POST" });
}

export function declineFriendRequest(requestId: string) {
  return request(`/api/friends/requests/${encodeURIComponent(requestId)}/decline`, { method: "POST" });
}

export function cancelFriendRequest(requestId: string) {
  return request(`/api/friends/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
}

export function removeFriend(friendId: string) {
  return request(`/api/friends/${encodeURIComponent(friendId)}`, { method: "DELETE" });
}

export function claimEmailInvite(token: string) {
  return request<{ message: string }>("/api/friends/invites/claim", { method: "POST", body: JSON.stringify({ token }) });
}
