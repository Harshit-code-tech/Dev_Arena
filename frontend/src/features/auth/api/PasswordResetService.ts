import { signOut } from "firebase/auth";

import { auth } from "../../../config/Firebase";
import { AUTH_ENDPOINTS } from "./AuthConstants";
import type {
  ForgotPasswordResponse,
  ResetPasswordInput,
} from "./AuthTypes";

export async function requestPasswordResetOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const response = await fetch(AUTH_ENDPOINTS.forgotPassword, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  const data = await response.json().catch(() => ({})) as ForgotPasswordResponse & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || "Failed to send password reset code.");
  }
  return data;
}

export async function resetPasswordWithOtp(input: ResetPasswordInput): Promise<{ message: string; requiresOnboarding?: boolean }> {
  const response = await fetch(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({})) as { message?: string; requiresOnboarding?: boolean };
  if (!response.ok) {
    throw new Error(data.message || "Failed to reset password.");
  }

  // A reset invalidates the old Firebase credential. Clear any stale local
  // Firebase session so the next sign-in always uses the new password.
  await signOut(auth).catch(() => undefined);
  return data;
}
