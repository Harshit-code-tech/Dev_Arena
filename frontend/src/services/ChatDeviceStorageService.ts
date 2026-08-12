const DEVICE_TOKEN_KEY = "devarena_chat_device_token_v1";
const DEVICE_NAME_KEY = "devarena_chat_device_name_v1";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function getChatDeviceToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DEVICE_TOKEN_KEY) || "";
}

export function ensureChatDeviceToken() {
  const existing = getChatDeviceToken();
  if (existing) return existing;
  const token = base64Url(window.crypto.getRandomValues(new Uint8Array(32)));
  window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
  return token;
}

export function getChatDeviceName() {
  if (typeof window === "undefined") return "Browser";
  const saved = window.localStorage.getItem(DEVICE_NAME_KEY);
  if (saved) return saved;
  const platform = navigator.platform || "Device";
  const browser = navigator.userAgent.includes("Edg/")
    ? "Edge"
    : navigator.userAgent.includes("Firefox/")
      ? "Firefox"
      : navigator.userAgent.includes("Chrome/")
        ? "Chrome"
        : navigator.userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  return `${browser} on ${platform}`.slice(0, 80);
}

export function setChatDeviceName(name: string) {
  window.localStorage.setItem(DEVICE_NAME_KEY, name.trim().slice(0, 80));
}
