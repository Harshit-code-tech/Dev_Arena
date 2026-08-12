import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

type Envelope<T> = { success: boolean; data: T; message?: string };

export type AdminMetricPoint = {
  at: string;
  activeUsers: number;
  newUsers: number;
  messages: number;
  projects: number;
  dsaLogs: number;
  tournamentActivity: number;
  githubEvents: number;
};

export type AdminMetricsPayload = {
  hours: number;
  generatedAt: string;
  summary: Record<string, number>;
  series: AdminMetricPoint[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({})) as Partial<Envelope<T>>;
  if (!response.ok || !payload.success || payload.data === undefined) throw new Error(payload.message || "Admin request failed.");
  return payload.data;
}

export const AdminApi = {
  access: () => request<{ allowed: boolean; role: string }>("/api/admin/access"),
  overview: () => request<Record<string, unknown>>("/api/admin/overview"),
  presenceHistory: (hours = 24) => request<Array<{ bucketAt: string; onlineCount: number }>>(`/api/admin/presence/history?hours=${hours}`),
  metrics: (hours = 24) => request<AdminMetricsPayload>(`/api/admin/metrics?hours=${hours}`),
  tournaments: () => request<any[]>("/api/admin/tournaments"),
  createTournament: (input: Record<string, unknown>) => request<any>("/api/admin/tournaments", { method: "POST", body: JSON.stringify(input) }),
  updateTournament: (id: string, input: Record<string, unknown>) => request<any>(`/api/admin/tournaments/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  questions: (id: string) => request<any[]>(`/api/admin/tournaments/${id}/questions`),
  createQuestion: (id: string, input: Record<string, unknown>) => request<any>(`/api/admin/tournaments/${id}/questions`, { method: "POST", body: JSON.stringify(input) }),
  submissions: (tournamentId?: string) => request<{ dsa: any[]; projects: any[] }>(`/api/admin/submissions${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : ""}`),
  reviewDsa: (id: string, input: Record<string, unknown>) => request<any>(`/api/admin/dsa-submissions/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  reviewProject: (id: string, input: Record<string, unknown>) => request<any>(`/api/admin/project-submissions/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  publishResults: (id: string) => request<any>(`/api/admin/tournaments/${id}/publish-results`, { method: "POST" }),
  announce: (id: string, input: { title: string; message: string }) => request<any>(`/api/admin/tournaments/${id}/announcements`, { method: "POST", body: JSON.stringify(input) }),
  moderation: () => request<{ feedback: any[]; reports: any[]; auditLogs: any[] }>("/api/admin/moderation"),
  systemHealth: () => request<Record<string, unknown>>("/api/admin/system-health"),
};
