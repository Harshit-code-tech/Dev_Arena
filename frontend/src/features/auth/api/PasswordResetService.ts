import { AUTH_ENDPOINTS } from "./AuthConstants";
import { parseJsonResponse } from "./AuthResponseService";
import type {
  ForgotPasswordResponse,
  ResetPasswordInput,
} from "./AuthTypes";

export async function requestPasswordResetOtp(email: string) {
  const response = await fetch(AUTH_ENDPOINTS.forgotPassword, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });

  return parseJsonResponse<ForgotPasswordResponse>(
    response,
    "Failed to send OTP.",
  );
}

export async function resetPasswordWithOtp(input: ResetPasswordInput) {
  const response = await fetch(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  await parseJsonResponse(response, "Failed to reset password.");
}
