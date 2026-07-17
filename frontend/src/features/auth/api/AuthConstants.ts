export const AUTH_TOKEN_STORAGE_KEY = "token";

export const DEVICE_TOKEN_STORAGE_KEY = "deviceToken";

export const AUTH_ENDPOINTS = {
  currentUser: "/api/auth/me",
  emailLogin: "/api/auth/login",
  emailRegister: "/api/auth/register",
  firebaseSync: "/api/auth/sync-firebase",
  setup2FA: "/api/auth/setup-2fa",
  verify2FA: "/api/auth/verify-2fa",
  sendOtp: "/api/auth/send-otp",
  verifyOtp: "/api/auth/verify-otp",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
} as const;

export const SOCIAL_PROVIDER_LABELS = {
  google: "Google",
  github: "GitHub",
} as const;

export const PASSWORD_STRENGTH_LABELS = [
  "",
  "weak",
  "fair",
  "good",
  "strong",
] as const;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COLOR_2FA_SETUP_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
] as const;

export const COLOR_2FA_REQUIRED_SEQUENCE_LENGTH = 3;

export const COLOR_2FA_MAX_FAILED_ATTEMPTS = 3;
