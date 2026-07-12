import { AUTH_ENDPOINTS } from "./AuthConstants";
import { parseJsonResponse } from "./AuthResponseService";
import {
  getStoredDeviceToken,
  storeDeviceToken,
} from "./AuthStorageService";
import type {
  EmailLoginInput,
  EmailLoginResult,
  EmailSignupInput,
  EmailSignupResult,
} from "./AuthTypes";

export async function loginWithEmail(
  input: EmailLoginInput,
): Promise<EmailLoginResult> {
  const response = await fetch(AUTH_ENDPOINTS.emailLogin, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildEmailLoginPayload(input)),
  });

  const data = await parseJsonResponse<EmailLoginResult>(
    response,
    "Login failed",
  );

  storeDeviceToken(data.deviceToken);

  return normalizeEmailLoginResult(data);
}

export async function registerWithEmail(
  input: EmailSignupInput,
): Promise<EmailSignupResult> {
  const response = await fetch(AUTH_ENDPOINTS.emailRegister, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildEmailSignupPayload(input)),
  });

  return parseJsonResponse<EmailSignupResult>(response, "Registration failed");
}

function buildEmailLoginPayload(input: EmailLoginInput) {
  return {
    email: input.email.trim(),
    password: input.password,
    remember: input.remember,
    deviceToken: getStoredDeviceToken(),
  };
}

function normalizeEmailLoginResult(
  result: EmailLoginResult,
): EmailLoginResult {
  return {
    ...result,
    verifyGrid: result.verifyGrid || [],
  };
}

function buildEmailSignupPayload(input: EmailSignupInput) {
  return {
    name: `${input.firstName.trim()} ${input.lastName.trim()}`,
    email: input.email.trim(),
    password: input.password,
  };
}
