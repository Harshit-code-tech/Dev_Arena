import { AUTH_ENDPOINTS } from "./AuthConstants";
import { parseJsonResponse } from "./AuthResponseService";
import { getStoredAuthToken } from "./AuthStorageService";

type AvailabilityResponse = {
  available: boolean;
  username: string;
  message: string;
};

type ChooseUsernameResponse = {
  message: string;
};

type CompleteOnboardingResponse = {
  message: string;
};

function authHeaders() {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your social sign-in session has expired. Please sign in again.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function checkUsernameAvailability(username: string) {
  const response = await fetch(
    `${AUTH_ENDPOINTS.usernameAvailability}?username=${encodeURIComponent(username)}`,
    { headers: authHeaders() },
  );
  return parseJsonResponse<AvailabilityResponse>(response, "Could not check username availability.");
}

export async function choosePermanentUsername(username: string) {
  const response = await fetch(AUTH_ENDPOINTS.chooseUsername, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  });
  return parseJsonResponse<ChooseUsernameResponse>(response, "Could not save username.");
}

export async function completeDevArenaOnboarding() {
  const response = await fetch(AUTH_ENDPOINTS.completeOnboarding, {
    method: "POST",
    headers: authHeaders(),
  });
  return parseJsonResponse<CompleteOnboardingResponse>(response, "Could not complete onboarding.");
}
