export const AUTH_TOKEN_STORAGE_KEY = "token";

export const AUTH_ENDPOINTS = {
  currentUser: "/api/auth/me",
  emailLogin: "/api/auth/login",
  emailRegister: "/api/auth/register",
  verifyAuthOtp: "/api/auth/verify-auth-otp",
  resendAuthOtp: "/api/auth/resend-auth-otp",
  firebaseSync: "/api/auth/sync-firebase",
  prepareFirebaseMigration: "/api/auth/prepare-firebase-migration",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
  usernameAvailability: "/api/auth/username-availability",
  chooseUsername: "/api/auth/choose-username",
  completeOnboarding: "/api/auth/complete-onboarding",
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
