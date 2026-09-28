import {
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
  getAdditionalUserInfo,
  setPersistence,
  signInWithPopup,
  signOut,
  type AuthProvider,
  type User,
  type UserCredential,
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

const ACCOUNT_NOT_CREATED_MESSAGE = "Account not created. Please create an account first.";

export async function signInWithSocialProvider(
  provider: SocialAuthProvider,
  options: { acceptLegal?: boolean; remember?: boolean } = {},
): Promise<SocialAuthResult> {
  const remember = options.remember !== false;
  const isSignup = options.acceptLegal === true;

  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithFirebasePopup(provider);
  const user = credential.user;

  // Firebase treats the first Google/GitHub sign-in as account creation. On the
  // DevArena LOGIN flow that is not allowed: a social account may only be
  // created from the Signup page (which explicitly sends acceptLegal=true).
  // Detect a first-time Firebase identity before any DevArena/Firestore sync,
  // remove it immediately, and show the login-only "create an account first"
  // message. Signup behavior remains unchanged.
  if (!isSignup && getAdditionalUserInfo(credential)?.isNewUser) {
    await removeRejectedFirebaseUser(user);
    throw new Error(ACCOUNT_NOT_CREATED_MESSAGE);
  }

  try {
    const syncResult = await syncFirebaseUser(user, provider, isSignup, { remember });
    return {
      token: syncResult.token,
      requiresUsername: syncResult.requiresUsername,
      requiresOnboarding: syncResult.requiresOnboarding,
      user,
    };
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    throw error;
  }
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

    case "LEGAL_ACCEPTANCE_REQUIRED":
      return ACCOUNT_NOT_CREATED_MESSAGE;

    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return `${providerName} ${action === "signup" ? "signup" : "login"} failed.`;
  }
}

async function signInWithFirebasePopup(provider: SocialAuthProvider): Promise<UserCredential> {
  return signInWithPopup(auth, getFirebaseProvider(provider));
}

async function removeRejectedFirebaseUser(user: User) {
  try {
    // The user has just authenticated, so deleteUser satisfies Firebase's
    // recent-login requirement and removes the temporary first-login account.
    await deleteUser(user);
  } finally {
    // deleteUser normally signs the user out already. This is intentionally
    // idempotent so a partial cleanup cannot leave an authenticated browser.
    await signOut(auth).catch(() => undefined);
  }
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
