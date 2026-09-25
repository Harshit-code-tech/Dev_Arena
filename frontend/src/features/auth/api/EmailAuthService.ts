import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";

import { auth } from "../../../config/Firebase";
import { AUTH_ENDPOINTS } from "./AuthConstants";
import type {
  AuthOtpPendingResult,
  AuthOtpResendResult,
  AuthOtpVerificationResult,
  EmailLoginDirectResult,
} from "./AuthTypes";

type LegacyMigrationResult = {
  migrationToken: string;
  displayName?: string;
};

type BackendAuthErrorBody = {
  message?: string;
  code?: string;
};

class BackendEmailAuthError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "BackendEmailAuthError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Email/password credentials are owned by Firebase Authentication.
 * DevArena only starts its own 6-digit email OTP after Firebase has created
 * and authenticated the password identity.
 */
export async function requestEmailRegister(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreeTerms: boolean;
}): Promise<AuthOtpPendingResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/g, " ");

  // Keep the Firebase identity available if the browser/window is closed while
  // the DevArena OTP screen is pending. Logout still signs Firebase out.
  await setPersistence(auth, browserLocalPersistence);

  let firebaseUser: FirebaseUser | null = null;
  let createdForThisAttempt = false;

  try {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, input.password);
      firebaseUser = credential.user;
      createdForThisAttempt = true;
      await updateProfile(firebaseUser, { displayName });
    } catch (error) {
      // A Firebase identity can already exist when a user started signup, closed
      // the browser on the OTP screen, then intentionally starts signup again.
      // Re-authenticate that identity and let the backend decide whether this is
      // an unfinished signup or an already-created DevArena account.
      if (getFirebaseErrorCode(error) !== "auth/email-already-in-use") throw error;
      const credential = await signInWithEmailAndPassword(auth, email, input.password);
      firebaseUser = credential.user;
      if (!firebaseUser.displayName) await updateProfile(firebaseUser, { displayName });
    }

    if (!firebaseUser) throw new Error("Firebase account creation did not return a user.");
    const idToken = await firebaseUser.getIdToken(true);
    const response = await fetch(AUTH_ENDPOINTS.emailRegister, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        name: displayName,
        acceptLegal: input.agreeTerms,
      }),
    });

    const data = await response.json().catch(() => ({})) as BackendAuthErrorBody & Partial<AuthOtpPendingResult>;
    if (!response.ok) {
      throw new BackendEmailAuthError(
        data.message || "Account registration failed.",
        response.status,
        data.code,
      );
    }

    return data as AuthOtpPendingResult;
  } catch (error) {
    // If this request created a brand-new Firebase identity but DevArena refused
    // the signup (for example an existing legacy Neon account), remove only that
    // just-created identity so the legitimate migration/login flow is not blocked.
    if (createdForThisAttempt && firebaseUser) {
      await deleteUser(firebaseUser).catch(() => undefined);
    }
    throw new Error(getEmailAuthErrorMessage(error, "signup"));
  }
}

/**
 * Firebase validates the email/password. The backend then applies DevArena's
 * OTP grace-period policy and either returns a session immediately or sends OTP.
 */
export async function requestEmailLogin(input: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<AuthOtpPendingResult | EmailLoginDirectResult> {
  const email = input.email.trim().toLowerCase();

  // Local Firebase persistence is intentional: an OTP challenge must survive a
  // browser/window close. DevArena's own token expiry still follows `remember`.
  await setPersistence(auth, browserLocalPersistence);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, input.password);

    try {
      return await startBackendFirebaseLogin(
        credential.user,
        input.remember === true,
      );
    } catch (error) {
      if (!(error instanceof BackendEmailAuthError) || error.code !== "FIREBASE_MIGRATION_REQUIRED") {
        throw error;
      }

      const migration = await prepareLegacyFirebaseMigration(email, input.password);
      return startBackendFirebaseLogin(
        credential.user,
        input.remember === true,
        migration.migrationToken,
      );
    }
  } catch (error) {
    if (!isFirebaseInvalidCredential(error)) {
      throw new Error(getEmailAuthErrorMessage(error, "login"));
    }

    // One-time migration for users created before Firebase password auth.
    // Their existing bcrypt password is checked once by the legacy migration
    // endpoint, then the password identity is permanently moved to Firebase.
    const migration = await prepareLegacyFirebaseMigration(email, input.password).catch(() => null);
    if (!migration) throw new Error("Incorrect email or password.");

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, input.password);
      if (migration.displayName) {
        await updateProfile(credential.user, { displayName: migration.displayName });
      }

      return await startBackendFirebaseLogin(
        credential.user,
        input.remember === true,
        migration.migrationToken,
      );
    } catch (migrationError) {
      if (getFirebaseErrorCode(migrationError) === "auth/email-already-in-use") {
        throw new Error("This account already exists in Firebase. Use Forgot password if you cannot sign in.");
      }
      throw new Error(getEmailAuthErrorMessage(migrationError, "login"));
    }
  }
}

/**
 * Verify DevArena's 6-digit OTP while also proving that the same Firebase
 * password identity is still signed in. This prevents a copied OTP temp token
 * from becoming a DevArena session by itself.
 */
export async function verifyEmailAuthOtp(
  tempToken: string,
  otp: string,
): Promise<AuthOtpVerificationResult> {
  const user = await currentFirebasePasswordUser();
  const idToken = await user.getIdToken(true);

  const response = await fetch(AUTH_ENDPOINTS.verifyAuthOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken, otp, idToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "Verification failed.");
  }

  return data as AuthOtpVerificationResult;
}

/** Resend the OTP email for an active signup/login challenge. */
export async function resendEmailAuthOtp(
  tempToken: string,
): Promise<AuthOtpResendResult> {
  const response = await fetch(AUTH_ENDPOINTS.resendAuthOtp, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tempToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || "A new verification code could not be sent.");
  }

  return data as AuthOtpResendResult;
}

async function startBackendFirebaseLogin(
  user: FirebaseUser,
  remember: boolean,
  migrationToken?: string,
): Promise<AuthOtpPendingResult | EmailLoginDirectResult> {
  const idToken = await user.getIdToken(true);
  const response = await fetch(AUTH_ENDPOINTS.emailLogin, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, remember, migrationToken }),
  });

  const data = await response.json().catch(() => ({})) as BackendAuthErrorBody;
  if (!response.ok) {
    throw new BackendEmailAuthError(
      data.message || "Login failed.",
      response.status,
      data.code,
    );
  }

  return data as AuthOtpPendingResult | EmailLoginDirectResult;
}

async function prepareLegacyFirebaseMigration(email: string, password: string) {
  const response = await fetch(AUTH_ENDPOINTS.prepareFirebaseMigration, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({})) as BackendAuthErrorBody & Partial<LegacyMigrationResult>;
  if (!response.ok || !data.migrationToken) {
    throw new Error(data.message || "Legacy account could not be migrated.");
  }

  return data as LegacyMigrationResult;
}

async function currentFirebasePasswordUser() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Your Firebase sign-in session expired. Return to login or signup and start again.");
  }

  const tokenResult = await user.getIdTokenResult();
  if (tokenResult.signInProvider !== "password") {
    throw new Error("This email verification belongs to an email/password account. Start again.");
  }
  return user;
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
  if (error instanceof BackendEmailAuthError) return error.message;

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
