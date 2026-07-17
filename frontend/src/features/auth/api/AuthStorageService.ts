import {
  AUTH_TOKEN_STORAGE_KEY,
  DEVICE_TOKEN_STORAGE_KEY,
} from "./AuthConstants";

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function getStoredDeviceToken() {
  return localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
}

export function storeDeviceToken(deviceToken?: string) {
  if (!deviceToken) {
    return;
  }

  localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, deviceToken);
}
