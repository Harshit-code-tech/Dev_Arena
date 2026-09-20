import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

/**
 * Resolve an API path for both development and production.
 *
 * - With VITE_API_URL set, requests go directly to that backend.
 * - Without it, relative /api paths keep working with the Vite dev proxy or
 *   any deployment-level rewrite already configured by the host.
 */
export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

/** Shared authenticated API request helper. */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "The request failed.");
  }

  return payload.data;
}
