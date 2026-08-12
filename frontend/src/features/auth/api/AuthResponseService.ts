import type { ApiErrorResponse } from "./AuthTypes";

export async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await response.json().catch(() => ({}) as ApiErrorResponse);

  if (!response.ok) {
    throw new Error((data as ApiErrorResponse).message || fallbackMessage);
  }

  return data as T;
}
