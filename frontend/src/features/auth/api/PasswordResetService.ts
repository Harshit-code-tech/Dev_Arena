import { sendPasswordResetEmail } from "firebase/auth";

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

  if (response.status === 409 && data.useFirebaseReset) {
    await sendPasswordResetEmail(auth, normalizedEmail);
    return {
      message: "Firebase sent a password-reset link to your email.",
      useFirebaseReset: true,
    } satisfies ForgotPasswordResponse;
  }

  if (!response.ok) {
    throw new Error(data.message || "Failed to send password reset instructions.");
  }

  return data;
}

export async function resetPasswordWithOtp(input: ResetPasswordInput) {
  const response = await fetch(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Failed to reset password.");
  }
}
