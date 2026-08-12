import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type AppNotification = {
  id: string;
  message: string;
  type: "reminder" | "summary" | "challenge" | "system";
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

function token() {
  const value = getStoredAuthToken();
  if (!value) throw new Error("Session expired.");
  return value;
}

export async function getNotifications(limit = 20): Promise<AppNotification[]> {
  const response = await fetch(`/api/notifications?limit=${limit}`, { headers: { Authorization: `Bearer ${token()}` } });
  const payload = (await response.json().catch(() => ({}))) as { data?: AppNotification[]; message?: string };
  if (!response.ok) throw new Error(payload.message || "Notifications could not be loaded.");
  return payload.data || [];
}

export async function markNotificationRead(id: string) {
  const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!response.ok) throw new Error("Notification could not be updated.");
}

export async function markAllNotificationsRead() {
  const response = await fetch("/api/notifications/read-all", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!response.ok) throw new Error("Notifications could not be updated.");
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await fetch("/api/notifications/unread-count", {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: { count?: number }; message?: string };
  if (!response.ok) throw new Error(payload.message || "Unread notifications could not be loaded.");
  return Math.max(0, Number(payload.data?.count || 0));
}
