import { AUTH_TOKEN_STORAGE_KEY } from "./AuthConstants";

const REALTIME_CURSOR_STORAGE_KEY = "devarena_realtime_cursor";
const AUTH_SESSION_MODE_STORAGE_KEY = "devarena_auth_session_mode";
const PERSISTENT_SESSION_MODE = "persistent";
const TAB_SESSION_MODE = "session";

/**
 * The DevArena session token is the source of truth for whether the website is
 * logged in. Persistent sessions live in localStorage; non-remembered sessions
 * live only in sessionStorage and therefore end with the browser tab/session.
 */
export function getStoredAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeAuthToken(token: string, remember = true) {
  const previousToken = getStoredAuthToken();
  if (previousToken !== token) sessionStorage.removeItem(REALTIME_CURSOR_STORAGE_KEY);

  // Always remove the opposite storage copy first. This prevents a token from
  // an earlier "Remember me" login from resurrecting a later session-only login.
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_SESSION_MODE_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_MODE_STORAGE_KEY);

  if (remember) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(AUTH_SESSION_MODE_STORAGE_KEY, PERSISTENT_SESSION_MODE);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(AUTH_SESSION_MODE_STORAGE_KEY, TAB_SESSION_MODE);
  }
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_SESSION_MODE_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_SESSION_MODE_STORAGE_KEY);
  sessionStorage.removeItem(REALTIME_CURSOR_STORAGE_KEY);
}
