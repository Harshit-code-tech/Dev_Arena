import type { AuthOtpPurpose } from "./AuthTypes";

const OTP_STORAGE_PREFIX = "devarena_auth_otp";
const USERNAME_DRAFT_PREFIX = "devarena_onboarding_username";
const OTP_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

export type StoredAuthOtpChallenge = {
  tempToken: string;
  email: string;
  resendAfterSeconds: number;
};

type StoredAuthOtpPayload = {
  tempToken: string;
  email: string;
  resendAvailableAt: number;
  expiresAt: number;
};

function otpStorageKey(purpose: AuthOtpPurpose) {
  return `${OTP_STORAGE_PREFIX}_${purpose}`;
}

export function storePendingAuthOtp(
  purpose: AuthOtpPurpose,
  challenge: StoredAuthOtpChallenge,
) {
  const now = Date.now();
  const payload: StoredAuthOtpPayload = {
    tempToken: challenge.tempToken,
    email: challenge.email,
    resendAvailableAt: now + Math.max(0, challenge.resendAfterSeconds) * 1000,
    expiresAt: now + OTP_SESSION_MAX_AGE_MS,
  };
  localStorage.setItem(otpStorageKey(purpose), JSON.stringify(payload));
}

export function getPendingAuthOtp(purpose: AuthOtpPurpose): StoredAuthOtpChallenge | null {
  const key = otpStorageKey(purpose);
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<StoredAuthOtpPayload>;
    if (
      typeof payload.tempToken !== "string" ||
      !payload.tempToken ||
      typeof payload.email !== "string" ||
      !payload.email ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(key);
      return null;
    }

    const resendAvailableAt = typeof payload.resendAvailableAt === "number"
      ? payload.resendAvailableAt
      : Date.now();

    return {
      tempToken: payload.tempToken,
      email: payload.email,
      resendAfterSeconds: Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)),
    };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearPendingAuthOtp(purpose: AuthOtpPurpose) {
  localStorage.removeItem(otpStorageKey(purpose));
}

function usernameDraftKey(userId: string) {
  return `${USERNAME_DRAFT_PREFIX}_${userId}`;
}

export function getOnboardingUsernameDraft(userId: string) {
  return localStorage.getItem(usernameDraftKey(userId)) || "";
}

export function storeOnboardingUsernameDraft(userId: string, username: string) {
  if (!username) {
    localStorage.removeItem(usernameDraftKey(userId));
    return;
  }
  localStorage.setItem(usernameDraftKey(userId), username);
}

export function clearOnboardingUsernameDraft(userId: string) {
  localStorage.removeItem(usernameDraftKey(userId));
}
