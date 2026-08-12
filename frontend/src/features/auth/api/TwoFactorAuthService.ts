import { AUTH_ENDPOINTS } from "./AuthConstants";
import { parseJsonResponse } from "./AuthResponseService";
import type { TwoFactorVerificationResponse } from "./AuthTypes";

export async function setupColor2FA(
  userId: string,
  colorSequence: string[],
) {
  const response = await fetch(AUTH_ENDPOINTS.setup2FA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, colorSequence }),
  });

  await parseJsonResponse(response, "Failed to setup 2FA");
}

export async function verifyColor2FA(
  tempToken: string | undefined,
  attemptSequence: string[],
) {
  const response = await fetch(AUTH_ENDPOINTS.verify2FA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken, attemptSequence }),
  });

  return parseJsonResponse<TwoFactorVerificationResponse>(
    response,
    "Invalid color sequence",
  );
}

export async function sendTwoFactorOtp(
  tempToken: string | undefined,
  confirmEmail: string,
) {
  const response = await fetch(AUTH_ENDPOINTS.sendOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken, confirmEmail }),
  });

  await parseJsonResponse(response, "Failed to send OTP. Check your email.");
}

export async function verifyTwoFactorOtp(
  tempToken: string | undefined,
  otp: string,
) {
  const response = await fetch(AUTH_ENDPOINTS.verifyOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken, otp }),
  });

  return parseJsonResponse<TwoFactorVerificationResponse>(
    response,
    "Invalid OTP",
  );
}
