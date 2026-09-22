import { auth } from "../../../config/Firebase";
import { AUTH_ENDPOINTS } from "./AuthConstants";
import { parseJsonResponse } from "./AuthResponseService";
import type { BackendAuthUser, BackendMeResponse } from "./AuthTypes";

export async function signOutFirebaseUser() {
  await auth.signOut();
}

/**
 * Permanently deletes the Firebase Auth account for the currently signed-in user.
 * Should be called when the user deletes their DevArena account so that the
 * Firebase identity is fully removed and cannot silently re-create a Neon record.
 * Falls back gracefully if there is no Firebase session (manual email/password users).
 */
export async function deleteFirebaseUser(): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await currentUser.delete();
    } catch (error) {
      // "auth/requires-recent-login" means the user's session is too old for
      // a destructive action. We still sign them out so the DevArena session ends.
      console.warn("Firebase user deletion failed (will sign out instead):", error);
      await auth.signOut();
    }
  }
}


export async function getCurrentBackendUser(token: string): Promise<BackendAuthUser> {
  const response = await fetch(AUTH_ENDPOINTS.currentUser, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await parseJsonResponse<BackendMeResponse>(response, "Failed to fetch current user");
  return mapBackendUserToAuthUser(data);
}

function mapBackendUserToAuthUser(data: BackendMeResponse): BackendAuthUser {
  return {
    uid: data.user.id,
    email: data.user.email,
    displayName: data.user.name,
    username: data.user.username,
    photoURL: data.user.avatarUrl,
    useInitials: data.user.useInitials,
    privacyMode: data.user.privacyMode,
    compactWorkspace: data.user.compactWorkspace,
    requiresUsername: data.user.requiresUsername,
    requiresOnboarding: data.user.requiresOnboarding,
    onboarding: data.user.onboarding,
    role: data.user.role,
    isAdmin: data.user.isAdmin,
  };
}
