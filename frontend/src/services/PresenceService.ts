import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

const SESSION_KEY = "devarena_presence_session_v1";

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export async function sendPresenceHeartbeat(route: string) {
  const token = getStoredAuthToken();
  if (!token) return;
  await fetch("/api/admin/presence/heartbeat", {
    method: "POST",
    keepalive: true,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: sessionId(), route }),
  }).catch(() => undefined);
}
