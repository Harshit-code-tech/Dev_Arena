import { AUTH_TOKEN_STORAGE_KEY } from "./AuthConstants";

const REALTIME_CURSOR_STORAGE_KEY = "devarena_realtime_cursor";

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeAuthToken(token: string) {
  const previousToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (previousToken !== token) sessionStorage.removeItem(REALTIME_CURSOR_STORAGE_KEY);
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(REALTIME_CURSOR_STORAGE_KEY);
}
