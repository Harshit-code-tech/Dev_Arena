import toast from "react-hot-toast";
import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export type RealtimeSyncEvent = {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

const CURSOR_KEY = "devarena_realtime_cursor";
const CHANNEL_NAME = "devarena_realtime_sync";
const seenEventIds = new Set<string>();
let stopController: AbortController | null = null;
let running = false;
let broadcastChannel: BroadcastChannel | null = null;

function emit(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function acknowledgeMessageDelivery(conversationId: string) {
  const token = getStoredAuthToken();
  if (!token || !conversationId) return;
  void fetch(`/api/player-hub/conversations/${encodeURIComponent(conversationId)}/delivered`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

function dispatchSyncEvent(event: RealtimeSyncEvent, broadcast = true) {
  if (seenEventIds.has(event.id)) return;
  seenEventIds.add(event.id);
  if (seenEventIds.size > 500) {
    const oldest = seenEventIds.values().next().value;
    if (oldest) seenEventIds.delete(oldest);
  }

  sessionStorage.setItem(CURSOR_KEY, event.id);
  emit("devarena:realtime-event", event);

  if (event.type === "player_hub.messages.changed") {
    const conversationId = typeof event.payload?.conversationId === "string"
      ? event.payload.conversationId
      : event.entityId || "";
    acknowledgeMessageDelivery(conversationId);
  }

  if (event.type === "toast.player_request_accepted") {
    const message = typeof event.payload?.message === "string"
      ? event.payload.message
      : "Your player request was accepted.";
    toast.success(message, { duration: 4200, id: `player-accepted-${event.id}` });
  }
  if (event.type === "toast.collaboration_application") {
    const message = typeof event.payload?.message === "string"
      ? event.payload.message
      : "Your collaboration application was updated.";
    toast.success(message, { duration: 5000, id: `collaboration-${event.id}` });
  }
  if (event.type === "notifications.changed") {
    emit("devarena:notifications-refresh", event);
  }
  if (event.type === "players.changed") {
    emit("devarena:players-refresh", event);
  }
  if (event.type === "profile.changed") {
    emit("devarena:players-refresh", event);
    emit("devarena:profile-updated", event);
  }
  if (event.type === "activity.changed" || event.type === "leaderboard.changed") {
    emit("devarena:activity-updated", event);
  }

  if (broadcast && broadcastChannel) {
    broadcastChannel.postMessage(event);
  }
}

function parseSseBlock(block: string) {
  let eventName = "message";
  let eventId = "";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? "" : line.slice(separator + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "event") eventName = value;
    if (field === "id") eventId = value;
    if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return;
  const payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;

  if (eventName === "ready") {
    const cursor = String(payload.cursor || "");
    if (cursor) sessionStorage.setItem(CURSOR_KEY, cursor);
    emit("devarena:notifications-refresh");
    emit("devarena:players-refresh");
    emit("devarena:activity-updated");
    return;
  }

  if (eventName === "sync") {
    dispatchSyncEvent({
      id: eventId || String(payload.id || ""),
      type: String(payload.type || "sync.changed"),
      entityType: payload.entityType ? String(payload.entityType) : null,
      entityId: payload.entityId ? String(payload.entityId) : null,
      payload: payload.payload && typeof payload.payload === "object"
        ? payload.payload as Record<string, unknown>
        : null,
      createdAt: String(payload.createdAt || new Date().toISOString()),
    });
  }
}

async function connect(signal: AbortSignal) {
  const token = getStoredAuthToken();
  if (!token) return false;

  const cursor = sessionStorage.getItem(CURSOR_KEY) || "";
  const response = await fetch(`/api/realtime/stream${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal,
  });

  if (response.status === 401) return false;
  if (!response.ok || !response.body) throw new Error("Realtime connection unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (block.trim()) {
        try {
          parseSseBlock(block);
        } catch (error) {
          console.error("Realtime event could not be parsed:", error);
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  return true;
}

export function startRealtimeSync() {
  if (running) return () => stopRealtimeSync();
  running = true;
  stopController = new AbortController();

  if ("BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (message: MessageEvent<RealtimeSyncEvent>) => {
      if (message.data?.id) dispatchSyncEvent(message.data, false);
    };
  }

  const signal = stopController.signal;
  void (async () => {
    let retryDelay = 1000;
    while (!signal.aborted && getStoredAuthToken()) {
      try {
        const authenticated = await connect(signal);
        if (!authenticated) break;
        retryDelay = 1000;
      } catch (error) {
        if (!signal.aborted) console.warn("Realtime sync reconnecting:", error);
      }

      if (signal.aborted) break;
      await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 2, 15000);
    }
  })();

  return () => stopRealtimeSync();
}

export function stopRealtimeSync() {
  running = false;
  stopController?.abort();
  stopController = null;
  broadcastChannel?.close();
  broadcastChannel = null;
}
