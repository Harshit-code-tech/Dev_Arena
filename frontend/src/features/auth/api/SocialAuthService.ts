import {
  signInWithPopup,
  type AuthProvider,
} from "firebase/auth";

import {
  auth,
  githubProvider,
  googleProvider,
} from "../../../config/Firebase";
import { SOCIAL_PROVIDER_LABELS } from "./AuthConstants";
import { syncFirebaseUser } from "./FirebaseUserSyncService";
import type {
  SocialAuthAction,
  SocialAuthProvider,
  SocialAuthResult,
} from "./AuthTypes";

export async function signInWithSocialProvider(
  provider: SocialAuthProvider,
): Promise<SocialAuthResult> {
  const user = await signInWithFirebasePopup(provider);
  const token = await syncFirebaseUser(user, provider);

  return {
    token,
    user,
  };
}

export function getSocialAuthErrorMessage(
  provider: SocialAuthProvider,
  action: SocialAuthAction,
  error: unknown,
) {
  const providerName = getProviderDisplayName(provider);
  const errorCode = getErrorCode(error);
  const actionLabel = action === "signup" ? "signup" : "sign-in";

  switch (errorCode) {
    case "auth/popup-closed-by-user":
      return `${providerName} ${actionLabel} was cancelled.`;

    case "auth/popup-blocked":
      return "Popup blocked. Please allow popups.";

    case "auth/network-request-failed":
      return "No internet connection detected.";

    case "auth/account-exists-with-different-credential":
      return "Account already exists with another login method.";

    default:
      return `${providerName} ${action === "signup" ? "signup" : "login"} failed.`;
  }
}

async function signInWithFirebasePopup(provider: SocialAuthProvider) {
  const result = await signInWithPopup(auth, getFirebaseProvider(provider));

  return result.user;
}

function getFirebaseProvider(provider: SocialAuthProvider): AuthProvider {
  return provider === "google" ? googleProvider : githubProvider;
}

function getProviderDisplayName(provider: SocialAuthProvider) {
  return SOCIAL_PROVIDER_LABELS[provider];
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }

  return "";
}
