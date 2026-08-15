import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type DayActivityItem = {
  id: string;
  title: string;
  description?: string | null;
  metadata: string[];
  occurredAt: string;
  points?: number;
  link?: string | null;
};

export type DayActivitySection = {
  key: string;
  title: string;
  items: DayActivityItem[];
};

export type DayActivity = {
  date: string;
  totalActivities: number;
  totalPoints: number;
  sections: DayActivitySection[];
};

export async function getDayActivity(date: string): Promise<DayActivity> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const timezoneOffset = new Date().getTimezoneOffset();
  const response = await fetch(`/api/activity/${encodeURIComponent(date)}?timezoneOffset=${timezoneOffset}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: DayActivity; message?: string };
  if (!response.ok || !payload.data) throw new Error(payload.message || "Activity details could not be loaded.");
  return payload.data;
}
