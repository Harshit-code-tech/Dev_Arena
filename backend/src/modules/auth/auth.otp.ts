import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { JWT_SECRET } from "./auth.tokens";

export const AUTH_OTP_TTL_MINUTES = 10;
export const AUTH_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const AUTH_OTP_MAX_ATTEMPTS = 5;

function otpSecret() {
  return process.env.AUTH_OTP_SECRET || JWT_SECRET;
}

export function generateAuthOtp() {
  return String(randomInt(100000, 1000000));
}

export function hashAuthOtp(otp: string) {
  return createHmac("sha256", otpSecret()).update(otp).digest("hex");
}

export function verifyAuthOtpHash(otp: string, expectedHash: string) {
  const actual = Buffer.from(hashAuthOtp(otp), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function authOtpExpiresAt() {
  return new Date(Date.now() + AUTH_OTP_TTL_MINUTES * 60 * 1000);
}

export function authOtpResendAvailableAt() {
  return new Date(Date.now() + AUTH_OTP_RESEND_COOLDOWN_SECONDS * 1000);
}

export function maskEmail(email: string) {
  const [rawLocal, rawDomain] = email.split("@");
  if (!rawLocal || !rawDomain) return email;
  const visible = rawLocal.slice(0, Math.min(2, rawLocal.length));
  return `${visible}${"•".repeat(Math.max(2, rawLocal.length - visible.length))}@${rawDomain}`;
}
