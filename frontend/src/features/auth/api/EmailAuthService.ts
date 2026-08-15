import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";

import { auth } from "../../../config/Firebase";
import { AUTH_ENDPOINTS } from "./AuthConstants";
import {
  FirebaseBackendSyncError,
  syncFirebaseUser,
} from "./FirebaseUserSyncService";
import type {
  EmailLoginInput,
  EmailLoginResult,
  EmailSignupInput,
  EmailSignupResult,
} from "./AuthTypes";

type LegacyMigrationResult = {
  migrationToken: string;
  displayName?: string;
};

export async function loginWithEmail(input: EmailLoginInput): Promise<EmailLoginResult> {
  const email = input.email.trim().toLowerCase();
  await setPersistence(
    auth,
    input.remember ? browserLocalPersistence : browserSessionPersistence,
  );

  try {
    const credential = await signInWithEmailAndPassword(auth, email, input.password);
    try {
      const synced = await syncFirebaseUser(credential.user, "password", false, {
        remember: input.remember === true,
      });
      if (!synced.token) throw new Error("DevArena session could not be created.");

      return {
        token: synced.token,
        requiresUsername: synced.requiresUsername,
        requiresOnboarding: synced.requiresOnboarding,
        user: credential.user,
        message: "Login successful",
      };
    } catch (syncError) {
      if (!(syncError instanceof FirebaseBackendSyncError) || syncError.code !== "FIREBASE_MIGRATION_REQUIRED") {
        throw syncError;
      }

      const migration = await prepareLegacyFirebaseMigration(email, input.password);
      const synced = await syncFirebaseUser(credential.user, "password", false, {
        remember: input.remember === true,
        migrationToken: migration.migrationToken,
      });
      if (!synced.token) throw new Error("DevArena session could not be created.");

      return {
        token: synced.token,
        requiresUsername: synced.requiresUsername,
        requiresOnboarding: synced.requiresOnboarding,
        user: credential.user,
        migratedFromLegacy: true,
        message: "Your DevArena password account was securely migrated to Firebase Authentication.",
      };
    }
  } catch (error) {
    if (!isFirebaseInvalidCredential(error)) {
      throw new Error(getEmailAuthErrorMessage(error, "login"));
    }

    // Existing DevArena email/password users from before this migration have a
    // bcrypt hash in Neon but no Firebase account. Verify that legacy password
    // once, create the Firebase identity, then permanently move auth to Firebase.
    const migration = await prepareLegacyFirebaseMigration(email, input.password).catch(() => null);
    if (!migration) {
      throw new Error("Incorrect email or password.");
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, input.password);
      if (migration.displayName) {
        await updateProfile(credential.user, { displayName: migration.displayName });
      }

      const synced = await syncFirebaseUser(credential.user, "password", false, {
        remember: input.remember === true,
        migrationToken: migration.migrationToken,
      });
      if (!synced.token) throw new Error("DevArena session could not be created.");

      return {
        token: synced.token,
        requiresUsername: synced.requiresUsername,
        requiresOnboarding: synced.requiresOnboarding,
        user: credential.user,
        migratedFromLegacy: true,
        message: "Your DevArena password account was securely migrated to Firebase Authentication.",
      };
    } catch (migrationError) {
      if (getFirebaseErrorCode(migrationError) === "auth/email-already-in-use") {
        throw new Error("This account already exists in Firebase. Use Forgot password if you cannot sign in.");
      }
      throw new Error(getEmailAuthErrorMessage(migrationError, "login"));
    }
  }
}

export async function registerWithEmail(input: EmailSignupInput): Promise<EmailSignupResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/g, " ");

  await setPersistence(auth, browserLocalPersistence);

  let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
  try {
    credential = await createUserWithEmailAndPassword(auth, email, input.password);
    await updateProfile(credential.user, { displayName });

    const synced = await syncFirebaseUser(credential.user, "password", input.agreeTerms, {
      remember: true,
    });
    if (!synced.token) throw new Error("DevArena session could not be created.");

    return {
      token: synced.token,
      requiresUsername: synced.requiresUsername,
      requiresOnboarding: synced.requiresOnboarding,
      user: credential.user,
      message: "Account created with Firebase Authentication",
    };
  } catch (error) {
    if (
      credential?.user &&
      error instanceof FirebaseBackendSyncError &&
      ["FIREBASE_MIGRATION_REQUIRED", "FIREBASE_IDENTITY_CONFLICT", "LEGAL_ACCEPTANCE_REQUIRED"].includes(error.code || "")
    ) {
      await deleteUser(credential.user).catch(() => undefined);
    } else if (credential?.user) {
      await signOut(auth).catch(() => undefined);
    }

    if (error instanceof FirebaseBackendSyncError && error.code === "FIREBASE_MIGRATION_REQUIRED") {
      throw new Error("A DevArena account with this email already exists. Log in with your existing password to migrate it to Firebase.");
    }
    throw new Error(getEmailAuthErrorMessage(error, "signup"));
  }
}

async function prepareLegacyFirebaseMigration(email: string, password: string) {
  const response = await fetch(AUTH_ENDPOINTS.prepareFirebaseMigration, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.migrationToken) {
    throw new Error(data.message || "Legacy account could not be migrated.");
  }

  return data as LegacyMigrationResult;
}

function isFirebaseInvalidCredential(error: unknown) {
  const code = getFirebaseErrorCode(error);
  return code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password";
}

function getFirebaseErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }
  return "";
}

function getEmailAuthErrorMessage(error: unknown, action: "login" | "signup") {
  if (error instanceof FirebaseBackendSyncError) return error.message;

  switch (getFirebaseErrorCode(error)) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "The password does not meet Firebase's password requirements.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many authentication attempts. Please wait and try again.";
    case "auth/network-request-failed":
      return "Firebase could not be reached. Check your internet connection.";
    case "auth/operation-not-allowed":
      return "Email/password authentication is not enabled in Firebase.";
    default:
      if (error instanceof Error && error.message) return error.message;
      return action === "signup" ? "Account creation failed." : "Login failed.";
  }
}
