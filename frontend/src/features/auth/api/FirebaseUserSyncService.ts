import type { User as FirebaseUser } from "firebase/auth";

import { AUTH_ENDPOINTS } from "./AuthConstants";
import { storeAuthToken } from "./AuthStorageService";
import { syncFirebaseUserWithFirestore } from "./FirestoreUserService";
import type { FirebaseAuthProvider } from "./AuthTypes";

type FirebaseSyncResult = {
  token?: string;
  requiresUsername: boolean;
  requiresOnboarding: boolean;
};

export class FirebaseBackendSyncError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "FirebaseBackendSyncError";
    this.status = status;
    this.code = code;
  }
}

export async function syncFirebaseUser(
  user: FirebaseUser,
  provider: FirebaseAuthProvider,
  acceptLegal = false,
  options: { remember?: boolean; migrationToken?: string } = {},
): Promise<FirebaseSyncResult> {
  const backendResult = await syncFirebaseUserWithBackend(
    user,
    provider,
    acceptLegal,
    options,
  );

  // Firestore is auxiliary profile storage. Neon is the DevArena account source of truth,
  // so a Firestore rules/network failure must never invalidate a successful login.
  void syncFirebaseUserWithFirestore(user, provider).catch((error) => {
    console.warn("Firestore profile sync skipped:", error);
  });

  return backendResult;
}

async function syncFirebaseUserWithBackend(
  user: FirebaseUser,
  provider: FirebaseAuthProvider,
  acceptLegal: boolean,
  options: { remember?: boolean; migrationToken?: string },
): Promise<FirebaseSyncResult> {
  const idToken = await user.getIdToken(true);
  const response = await fetch(AUTH_ENDPOINTS.firebaseSync, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      provider,
      displayName: user.displayName,
      photoURL: user.photoURL,
      acceptLegal,
      remember: options.remember !== false,
      migrationToken: options.migrationToken,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new FirebaseBackendSyncError(
      data.message || "Failed to sync Firebase account with DevArena.",
      response.status,
      data.code,
    );
  }

  if (data.token) storeAuthToken(data.token);

  return {
    token: data.token as string | undefined,
    requiresUsername: Boolean(data.user?.requiresUsername),
    requiresOnboarding: Boolean(data.user?.requiresOnboarding),
  };
}
