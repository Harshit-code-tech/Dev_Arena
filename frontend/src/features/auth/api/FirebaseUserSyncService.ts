import type { User as FirebaseUser } from "firebase/auth";

import { AUTH_ENDPOINTS } from "./AuthConstants";
import { storeAuthToken } from "./AuthStorageService";
import { syncFirebaseUserWithFirestore } from "./FirestoreUserService";
import type { SocialAuthProvider } from "./AuthTypes";

export async function syncFirebaseUser(
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
  const backendToken = await syncFirebaseUserWithBackend(user, provider);
  await syncFirebaseUserWithFirestore(user, provider);

  return backendToken;
}

async function syncFirebaseUserWithBackend(
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
  try {
    const response = await fetch(AUTH_ENDPOINTS.firebaseSync, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildFirebaseSyncPayload(user, provider)),
    });

    if (!response.ok) {
      console.error("Failed to sync user with Neon backend", await response.text());
      return undefined;
    }

    const data = await response.json();

    if (data.token) {
      storeAuthToken(data.token);
    }

    return data.token as string | undefined;
  } catch (error) {
    console.error("Error syncing user with backend:", error);
    return undefined;
  }
}

function buildFirebaseSyncPayload(
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    provider,
  };
}
