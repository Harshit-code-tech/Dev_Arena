import { AUTH_ENDPOINTS } from "./AuthConstants";
import type {
  AuthOtpPendingResult,
  AuthOtpVerificationResult,
  AuthOtpResendResult,
} from "./AuthTypes";

/**
 * Step 1 of email signup — backend validates credentials and sends an OTP email.
 * No Firebase involved. Returns a tempToken to use in verifyEmailAuthOtp.
 */
export async function requestEmailRegister(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreeTerms: boolean;
}): Promise<AuthOtpPendingResult> {
  const name = `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/g, " ");
  const response = await fetch(AUTH_ENDPOINTS.emailRegister, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email: input.email.trim().toLowerCase(),
      password: input.password,
      acceptLegal: input.agreeTerms,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Account registration failed.");
  }

  return data as AuthOtpPendingResult;
}

/**
 * Step 1 of email login — backend verifies credentials and sends an OTP email.
 * No Firebase involved. Returns a tempToken to use in verifyEmailAuthOtp.
 */
export async function requestEmailLogin(input: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<AuthOtpPendingResult> {
  const response = await fetch(AUTH_ENDPOINTS.emailLogin, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      remember: input.remember === true,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Login failed.");
  }

  return data as AuthOtpPendingResult;
}

/**
 * Step 2 for both signup and login — submit the 6-digit OTP code.
 * On signup: backend creates the Neon DB user and returns a session token.
 * On login: backend verifies the user and returns a session token.
 * No Firebase involved.
 */
export async function verifyEmailAuthOtp(
  tempToken: string,
  otp: string,
): Promise<AuthOtpVerificationResult> {
  const response = await fetch(AUTH_ENDPOINTS.verifyAuthOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken, otp }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Verification failed.");
  }

  return data as AuthOtpVerificationResult;
}

/**
 * Resend the OTP email for an active verification session.
 * Works for both signup and login sessions.
 */
export async function resendEmailAuthOtp(
  tempToken: string,
): Promise<AuthOtpResendResult> {
  const response = await fetch(AUTH_ENDPOINTS.resendAuthOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "A new verification code could not be sent.");
  }

  return data as AuthOtpResendResult;
}
