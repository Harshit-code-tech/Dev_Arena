import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type DevArenaSettings = {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  useInitials: boolean;
  activityReminders: boolean;
  privacyMode: boolean;
  compactWorkspace: boolean;
  friendRequestEmails: boolean;
  loginOtpEmails: boolean;
  streakReminderEmails: boolean;
  challengeNotifications: boolean;
  inAppNotifications: boolean;
  createdAt: string;
};

export type SettingsPreferenceKey =
  | "useInitials"
  | "activityReminders"
  | "privacyMode"
  | "compactWorkspace"
  | "friendRequestEmails"
  | "loginOtpEmails"
  | "streakReminderEmails"
  | "challengeNotifications"
  | "inAppNotifications";

type ApiEnvelope<T> = { success?: boolean; data: T; message?: string };

function token() {
  const value = getStoredAuthToken();
  if (!value) throw new Error("Your session has expired. Please sign in again.");
  return value;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token()}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(payload.message || "Settings request failed.");
  return payload.data;
}

export function getSettings() {
  return request<DevArenaSettings>("/api/settings");
}

export function updateSettingsPreferences(payload: Partial<Record<SettingsPreferenceKey, boolean>>) {
  return request<DevArenaSettings>("/api/settings/preferences", { method: "PUT", body: JSON.stringify(payload) });
}

export function updateProfilePhoto(payload: { imageData?: string; imageUrl?: string }) {
  return request<DevArenaSettings>("/api/settings/photo", { method: "POST", body: JSON.stringify(payload) });
}

export function requestIdentityChange(payload: { name?: string; email?: string }) {
  return request<{ message: string }>("/api/settings/identity/request", { method: "POST", body: JSON.stringify(payload) });
}

export function confirmIdentityChange(otp: string) {
  return request<DevArenaSettings>("/api/settings/identity/confirm", { method: "POST", body: JSON.stringify({ otp }) });
}

export async function downloadAccountData() {
  const response = await fetch("/api/settings/export", { headers: { Authorization: `Bearer ${token()}` } });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || "Could not export account data.");
  }
  return response.blob();
}

export function deleteAccount(confirmation: string) {
  return request<{ message: string }>("/api/settings/account", { method: "DELETE", body: JSON.stringify({ confirmation }) });
}
