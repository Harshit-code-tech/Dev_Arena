import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

type ApiEnvelope<T> = { success: boolean; data: T; message?: string };

/**
 * Shared authenticated API request helper.
 *
 * Reads the stored auth token, attaches it as a Bearer header, parses the
 * standard `{ success, data, message }` envelope, and returns the unwrapped
 * data on success or throws an Error with the server message on failure.
 *
 * This is the single source of truth for authenticated API calls. Individual
 * service files should import and delegate to this instead of reimplementing
 * the fetch/envelope pattern.
 */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getStoredAuthToken();
    if (!token) throw new Error("Your session has expired. Please sign in again.");

    const response = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
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
