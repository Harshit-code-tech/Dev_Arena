import bcrypt from "bcryptjs";
import type { AuthOtpPurpose } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { sendAuthOtpEmail } from "../../shared/utils/email";
import { authRepository, createPendingUsername, PENDING_USERNAME_PREFIX } from "./auth.repository";
import {
  AUTH_OTP_MAX_ATTEMPTS,
  AUTH_OTP_RESEND_COOLDOWN_SECONDS,
  authOtpExpiresAt,
  authOtpResendAvailableAt,
  generateAuthOtp,
  hashAuthOtp,
  maskEmail,
  verifyAuthOtpHash,

} from "./auth.otp";
import {
  generateAuthOtpToken,
  generateAuthToken,
  generateFirebaseMigrationToken,
  generatePasswordResetToken,
  verifyAuthToken,
} from "./auth.tokens";
import type {
  AuthServiceResult,
  ChooseUsernameInput,
  ForgotPasswordInput,
  LoginInput,
  PrepareFirebaseMigrationInput,
  RegisterInput,
  ResendAuthOtpInput,
  ResetPasswordInput,
  SyncFirebaseInput,
  VerifyAuthOtpInput,
} from "./auth.types";
import { completeOnboarding as finalizeOnboarding, getOnboardingStatus } from "./onboarding.service";
import {
  createFirebasePasswordUser,
  findFirebaseUserByEmail,
  updateFirebasePassword,
  verifyFirebaseIdToken,
} from "./firebase-auth.service";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requiresUsername(username: string | undefined, usernameChosen = true) {
  return usernameChosen === false || !username || username.startsWith(PENDING_USERNAME_PREFIX);
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

/** OTP grace period: if the user verified DevArena email OTP within this window, login can skip a new code. */
const OTP_GRACE_PERIOD_DAYS = 15;

function createUserPayload(user: {
  id: string;
  email: string;
  name: string;
  username?: string;
  usernameChosen?: boolean;
  onboardingRequired?: boolean;
  role?: string;
}) {
  const usernameRequired = requiresUsername(user.username, user.usernameChosen);
  const envAdmins = new Set(String(process.env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
  const isAdmin = user.role === "Admin" || user.role === "Judge" || envAdmins.has(user.email.toLowerCase());
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: usernameRequired ? "" : user.username,
    requiresUsername: usernameRequired,
    requiresOnboarding: Boolean(user.onboardingRequired),
    role: user.role || "User",
    isAdmin,
  };
}

function validateUsername(username: string) {
  if (!/^[a-z0-9._]{3,24}$/.test(username) || username.startsWith(PENDING_USERNAME_PREFIX)) {
    return "Username must contain 3–24 lowercase letters, numbers, dots, or underscores";
  }
  return null;
}

async function nextPendingUsername() {
  let pendingUsername = createPendingUsername();
  while (await authRepository.findUserByUsername(pendingUsername)) {
    pendingUsername = createPendingUsername();
  }
  return pendingUsername;
}

function otpEmailPurpose(purpose: AuthOtpPurpose) {
  return purpose === "Signup" ? "signup" as const : "login" as const;
}

async function invalidateActiveChallenges(email: string, purpose: AuthOtpPurpose) {
  await prisma.authOtpChallenge.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

async function createOtpChallenge(input: {
  purpose: AuthOtpPurpose;
  email: string;
  userId?: string;
  pendingName?: string;
  pendingPasswordHash?: string;
  rememberSession?: boolean;
}) {
  await invalidateActiveChallenges(input.email, input.purpose);

  const otp = generateAuthOtp();
  const challenge = await prisma.authOtpChallenge.create({
    data: {
      purpose: input.purpose,
      email: input.email,
      userId: input.userId,
      pendingName: input.pendingName,
      pendingPasswordHash: input.pendingPasswordHash,
      otpHash: hashAuthOtp(otp),
      expiresAt: authOtpExpiresAt(),
      resendAvailableAt: authOtpResendAvailableAt(),
      attempts: 0,
      maxAttempts: AUTH_OTP_MAX_ATTEMPTS,
      rememberSession: Boolean(input.rememberSession),
    },
  });

  const sent = await sendAuthOtpEmail(input.email, otp, otpEmailPurpose(input.purpose));
  if (!sent) {
    await prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    throw new Error("OTP_EMAIL_DELIVERY_FAILED");
  }

  return {
    challenge,
    tempToken: generateAuthOtpToken(challenge.id, challenge.purpose, challenge.rememberSession),
  };
}

function parseOtpToken(tempToken: string) {
  const decoded = verifyAuthToken(tempToken);
  if (!decoded.isAuthOtpPending || !decoded.authOtpChallengeId || !decoded.authOtpPurpose) {
    throw new Error("INVALID_AUTH_OTP_TOKEN");
  }
  return decoded;
}

function otpPendingResponse(
  challenge: { email: string },
  tempToken: string,
  message: string,
): AuthServiceResult {
  return {
    statusCode: 200,
    body: {
      requiresOtp: true,
      tempToken,
      email: maskEmail(challenge.email),
      resendAfterSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS,
      message,
    },
  };
}


function isWithinOtpGrace(lastOtpVerifiedAt: Date | null | undefined) {
  if (!lastOtpVerifiedAt) return false;
  const gracePeriodMs = OTP_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - lastOtpVerifiedAt.getTime() < gracePeriodMs;
}

function firebaseServiceError(message: string, fallback: string): AuthServiceResult | null {
  if (message === "FIREBASE_MIGRATION_REQUIRED") {
    return {
      statusCode: 409,
      body: {
        code: "FIREBASE_MIGRATION_REQUIRED",
        message: "This DevArena account predates Firebase password authentication. Log in with your existing password once to migrate it securely.",
      },
    };
  }
  if (message === "FIREBASE_IDENTITY_CONFLICT") {
    return {
      statusCode: 409,
      body: { code: "FIREBASE_IDENTITY_CONFLICT", message: "This email is already linked to another Firebase identity." },
    };
  }
  if (message === "LEGAL_ACCEPTANCE_REQUIRED") {
    return {
      statusCode: 403,
      body: {
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "No verified DevArena account exists for this Firebase login. Complete signup and email OTP verification first.",
      },
    };
  }
  if (message === "FIREBASE_PROJECT_ID_NOT_CONFIGURED") {
    return {
      statusCode: 503,
      body: { code: "FIREBASE_NOT_CONFIGURED", message: "Firebase token verification is not configured on the DevArena backend." },
    };
  }
  if (message === "FIREBASE_ADMIN_NOT_CONFIGURED" || message === "FIREBASE_ADMIN_CREDENTIALS_INVALID") {
    return {
      statusCode: 503,
      body: {
        code: "FIREBASE_ADMIN_NOT_CONFIGURED",
        message: "Firebase password administration is not configured on the DevArena backend.",
      },
    };
  }
  if (message === "FIREBASE_WEB_API_KEY_NOT_CONFIGURED") {
    return {
      statusCode: 503,
      body: {
        code: "FIREBASE_WEB_API_KEY_NOT_CONFIGURED",
        message: "Firebase password administration is missing its Web API key.",
      },
    };
  }
  if (message === "FIREBASE_ADMIN_AUTH_FAILED" || message.startsWith("FIREBASE_ADMIN_REQUEST_FAILED")) {
    return {
      statusCode: 503,
      body: {
        code: "FIREBASE_ADMIN_UNAVAILABLE",
        message: "Firebase password administration is temporarily unavailable. Try again.",
      },
    };
  }
  if (message.startsWith("FIREBASE_CERT_FETCH_FAILED")) {
    return {
      statusCode: 503,
      body: { code: "FIREBASE_VERIFICATION_UNAVAILABLE", message: "Firebase verification is temporarily unavailable. Try again." },
    };
  }
  if (message === "FIREBASE_PROVIDER_NOT_SUPPORTED") {
    return {
      statusCode: 400,
      body: { code: "FIREBASE_PROVIDER_NOT_SUPPORTED", message: "This endpoint requires Firebase email/password authentication." },
    };
  }
  if (message.includes("jwt") || message.startsWith("FIREBASE_ID_TOKEN")) {
    return {
      statusCode: 401,
      body: { code: "FIREBASE_TOKEN_INVALID", message: "Firebase sign-in could not be verified. Please sign in again." },
    };
  }
  if (message.startsWith("FIREBASE_")) {
    return {
      statusCode: 401,
      body: { code: "FIREBASE_TOKEN_INVALID", message: fallback },
    };
  }
  return null;
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthServiceResult> {
    try {
      const idToken = String(input.idToken || "");
      const trimmedName = String(input.name || "").trim().replace(/\s+/g, " ");
      if (!idToken || !trimmedName) {
        return { statusCode: 400, body: { message: "Firebase sign-in and name are required" } };
      }
      if (input.acceptLegal !== true) {
        return { statusCode: 400, body: { message: "You must accept the Terms of Service and Privacy Policy to continue" } };
      }
      if (trimmedName.length < 2 || trimmedName.length > 80) {
        return { statusCode: 400, body: { message: "Name must contain 2 to 80 characters" } };
      }

      const identity = await verifyFirebaseIdToken(idToken);
      if (identity.provider !== "password") throw new Error("FIREBASE_PROVIDER_NOT_SUPPORTED");

      const existingByUid = await prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
      const existingByEmail = await authRepository.findUserByEmail(identity.email);
      const existing = existingByUid || existingByEmail;
      if (existing) {
        if (!existing.firebaseUid) {
          return {
            statusCode: 409,
            body: {
              code: "FIREBASE_MIGRATION_REQUIRED",
              message: "A DevArena account with this email already exists. Log in with its existing password once to migrate it to Firebase.",
            },
          };
        }
        if (existing.firebaseUid !== identity.uid) {
          return {
            statusCode: 409,
            body: { code: "FIREBASE_IDENTITY_CONFLICT", message: "This email is already linked to another Firebase identity." },
          };
        }
        return { statusCode: 409, body: { message: "An account with this email already exists. Log in instead." } };
      }

      const { challenge, tempToken } = await createOtpChallenge({
        purpose: "Signup",
        email: identity.email,
        pendingName: trimmedName,
        rememberSession: true,
      });

      return otpPendingResponse(challenge, tempToken, "Firebase account created. Enter the verification code sent to your email to finish signup.");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error("Registration Error:", error);
      if (message === "OTP_EMAIL_DELIVERY_FAILED") {
        return { statusCode: 502, body: { message: "The verification email could not be sent. Check the email service configuration and try again." } };
      }
      return firebaseServiceError(message, "Firebase signup could not be verified.")
        || { statusCode: 500, body: { message: "An unexpected error occurred during registration" } };
    }
  },

  async login(input: LoginInput): Promise<AuthServiceResult> {
    try {
      const idToken = String(input.idToken || "");
      if (!idToken) {
        return { statusCode: 400, body: { message: "Firebase sign-in is required" } };
      }

      const identity = await verifyFirebaseIdToken(idToken);
      if (identity.provider !== "password") throw new Error("FIREBASE_PROVIDER_NOT_SUPPORTED");

      let migrationUserId: string | undefined;
      if (input.migrationToken) {
        const migration = verifyAuthToken(input.migrationToken);
        if (
          !migration.isFirebaseMigration ||
          !migration.userId ||
          !migration.firebaseMigrationEmail ||
          migration.firebaseMigrationEmail.toLowerCase() !== identity.email.toLowerCase()
        ) {
          return { statusCode: 401, body: { message: "The Firebase migration proof is invalid or expired." } };
        }
        migrationUserId = migration.userId;
      }

      const user = await authRepository.upsertFirebaseUser({
        firebaseUid: identity.uid,
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: identity.displayName,
        photoURL: identity.photoURL,
        provider: "password",
        acceptLegal: false,
        migrationUserId,
        allowOrphanRecovery: false,
      });

      // Firebase has already validated the password. DevArena keeps the existing
      // 15-day email-OTP grace period as the second authentication layer.
      if (user.isEmailVerified && isWithinOtpGrace(user.lastOtpVerifiedAt)) {
        const token = generateAuthToken(user.id, input.remember === true);
        return {
          statusCode: 200,
          body: {
            requiresOtp: false,
            message: "Login successful",
            token,
            user: createUserPayload(user),
          },
        };
      }

      const { challenge, tempToken } = await createOtpChallenge({
        purpose: "Login",
        email: user.email,
        userId: user.id,
        rememberSession: input.remember === true,
      });

      return otpPendingResponse(challenge, tempToken, "Firebase password verified. Enter the code sent to your email to finish signing in.");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error("Login Error:", error);
      if (message === "OTP_EMAIL_DELIVERY_FAILED") {
        return { statusCode: 502, body: { message: "The login code could not be sent. Check the email service configuration and try again." } };
      }
      return firebaseServiceError(message, "Firebase login could not be verified.")
        || { statusCode: 500, body: { message: "An unexpected error occurred during login" } };
    }
  },


  async verifyAuthOtp(input: VerifyAuthOtpInput): Promise<AuthServiceResult> {
    try {
      const tempToken = String(input.tempToken || "");
      const otp = String(input.otp || "").trim();
      const idToken = String(input.idToken || "");
      if (!tempToken || !/^\d{6}$/.test(otp) || !idToken) {
        return { statusCode: 400, body: { message: "Enter the complete 6-digit verification code while signed in with Firebase" } };
      }

      const identity = await verifyFirebaseIdToken(idToken);
      if (identity.provider !== "password") throw new Error("FIREBASE_PROVIDER_NOT_SUPPORTED");

      const decoded = parseOtpToken(tempToken);
      const challenge = await prisma.authOtpChallenge.findUnique({ where: { id: decoded.authOtpChallengeId } });
      if (!challenge || challenge.purpose !== decoded.authOtpPurpose) {
        return { statusCode: 401, body: { message: "This verification request is invalid. Start again." } };
      }
      if (challenge.email.toLowerCase() !== identity.email.toLowerCase()) {
        return { statusCode: 401, body: { message: "This verification request belongs to a different Firebase account. Start again." } };
      }
      if (challenge.consumedAt) {
        return { statusCode: 409, body: { message: "This verification code has already been used. Start again." } };
      }
      if (new Date() > challenge.expiresAt) {
        await prisma.authOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
        return { statusCode: 410, body: { message: "The verification code has expired. Start again or request a new code." } };
      }
      if (challenge.attempts >= challenge.maxAttempts) {
        return { statusCode: 429, body: { message: "Too many incorrect attempts. Start the verification again." } };
      }

      if (!verifyAuthOtpHash(otp, challenge.otpHash)) {
        const attempts = challenge.attempts + 1;
        await prisma.authOtpChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts,
            ...(attempts >= challenge.maxAttempts ? { consumedAt: new Date() } : {}),
          },
        });
        if (attempts >= challenge.maxAttempts) {
          return { statusCode: 429, body: { message: "Too many incorrect attempts. Start the verification again." } };
        }
        return {
          statusCode: 400,
          body: {
            message: `Incorrect verification code. ${challenge.maxAttempts - attempts} attempt${challenge.maxAttempts - attempts === 1 ? "" : "s"} remaining.`,
          },
        };
      }

      if (challenge.purpose === "Signup") {
        if (!challenge.pendingName) {
          return { statusCode: 409, body: { message: "The signup verification is incomplete. Start again." } };
        }

        const existingByUid = await prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
        const existingByEmail = await authRepository.findUserByEmail(challenge.email);
        if (existingByUid || existingByEmail) {
          await prisma.authOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
          return { statusCode: 409, body: { message: "An account with this email already exists. Log in instead." } };
        }

        const pendingUsername = await nextPendingUsername();
        const user = await prisma.$transaction(async (tx) => {
          const claimed = await tx.authOtpChallenge.updateMany({
            where: { id: challenge.id, consumedAt: null },
            data: { consumedAt: new Date(), pendingPasswordHash: null },
          });
          if (claimed.count !== 1) throw new Error("OTP_ALREADY_CONSUMED");

          return tx.user.create({
            data: {
              firebaseUid: identity.uid,
              email: challenge.email,
              passwordHash: null,
              name: challenge.pendingName!,
              username: pendingUsername,
              usernameChosen: false,
              onboardingRequired: true,
              // DevArena's numeric OTP verified ownership of the email. Firebase
              // remains the source of truth for the password credential itself.
              isEmailVerified: true,
              lastOtpVerifiedAt: new Date(),
              termsAcceptedAt: new Date(),
              termsVersion: "2026-08-02",
              privacyVersion: "2026-08-02",
            },
          });
        });

        const token = generateAuthToken(user.id, true);
        return {
          statusCode: 200,
          body: {
            message: "Email verified and Firebase account linked to DevArena",
            token,
            user: createUserPayload(user),
          },
        };
      }

      if (!challenge.userId) {
        return { statusCode: 409, body: { message: "The login verification is incomplete. Start again." } };
      }
      const user = await authRepository.findUserById(challenge.userId);
      if (!user) {
        return { statusCode: 404, body: { message: "User not found" } };
      }
      if (!user.firebaseUid || user.firebaseUid !== identity.uid || user.email.toLowerCase() !== identity.email.toLowerCase()) {
        return { statusCode: 401, body: { message: "This verification request does not match the signed-in Firebase account." } };
      }

      const verifiedUser = await prisma.$transaction(async (tx) => {
        const claimed = await tx.authOtpChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error("OTP_ALREADY_CONSUMED");
        return tx.user.update({
          where: { id: user.id },
          data: {
            isEmailVerified: true,
            lastOtpVerifiedAt: new Date(),
            failedLoginAttempts: 0,
            failedLoginLockedUntil: null,
          },
        });
      });

      const token = generateAuthToken(verifiedUser.id, challenge.rememberSession);
      return {
        statusCode: 200,
        body: {
          message: "Login verified",
          token,
          user: createUserPayload(verifiedUser),
        },
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message === "jwt expired") {
        return { statusCode: 410, body: { message: "This verification session has expired. Start again." } };
      }
      if (message === "OTP_ALREADY_CONSUMED") {
        return { statusCode: 409, body: { message: "This verification code has already been used. Start again." } };
      }
      if (message === "INVALID_AUTH_OTP_TOKEN") {
        return { statusCode: 401, body: { message: "This verification request is invalid. Start again." } };
      }
      const firebaseError = firebaseServiceError(message, "Firebase sign-in could not be verified for this OTP.");
      if (firebaseError) return firebaseError;
      const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (errorCode === "P2002") {
        return { statusCode: 409, body: { message: "An account with this email already exists" } };
      }
      console.error("Auth OTP verification error:", error);
      return { statusCode: 500, body: { message: "The verification code could not be checked. Try again." } };
    }
  },

  async resendAuthOtp(input: ResendAuthOtpInput): Promise<AuthServiceResult> {
    try {
      const tempToken = String(input.tempToken || "");
      if (!tempToken) return { statusCode: 400, body: { message: "Verification session is required" } };

      const decoded = parseOtpToken(tempToken);
      const challenge = await prisma.authOtpChallenge.findUnique({ where: { id: decoded.authOtpChallengeId } });
      if (!challenge || challenge.purpose !== decoded.authOtpPurpose) {
        return { statusCode: 401, body: { message: "This verification request is invalid. Start again." } };
      }
      if (challenge.consumedAt) {
        return { statusCode: 409, body: { message: "This verification request is no longer active. Start again." } };
      }

      const remainingMs = challenge.resendAvailableAt.getTime() - Date.now();
      if (remainingMs > 0) {
        const retryAfterSeconds = Math.ceil(remainingMs / 1000);
        return {
          statusCode: 429,
          body: { message: `Wait ${retryAfterSeconds} seconds before requesting another code.`, retryAfterSeconds },
        };
      }

      const otp = generateAuthOtp();
      const updated = await prisma.authOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          otpHash: hashAuthOtp(otp),
          expiresAt: authOtpExpiresAt(),
          resendAvailableAt: authOtpResendAvailableAt(),
          attempts: 0,
        },
      });

      const sent = await sendAuthOtpEmail(updated.email, otp, otpEmailPurpose(updated.purpose));
      if (!sent) {
        await prisma.authOtpChallenge.update({ where: { id: updated.id }, data: { consumedAt: new Date() } });
        return { statusCode: 502, body: { message: "The verification email could not be sent. Start again and retry." } };
      }

      return {
        statusCode: 200,
        body: {
          message: "A new verification code was sent",
          tempToken: generateAuthOtpToken(updated.id, updated.purpose, updated.rememberSession),
          email: maskEmail(updated.email),
          resendAfterSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        },
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message === "jwt expired") {
        return { statusCode: 410, body: { message: "This verification session has expired. Start again." } };
      }
      if (message === "INVALID_AUTH_OTP_TOKEN" || message.includes("jwt")) {
        return { statusCode: 401, body: { message: "This verification request is invalid. Start again." } };
      }
      console.error("Auth OTP resend error:", error);
      return { statusCode: 500, body: { message: "A new verification code could not be sent" } };
    }
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<AuthServiceResult> {
    try {
      const email = String(input.email || "").trim().toLowerCase();
      if (!email) return { statusCode: 400, body: { message: "Email is required" } };

      const user = await authRepository.findUserByEmail(email);
      if (!user) return { statusCode: 404, body: { message: "Email is not registered with us" } };

      // Password ownership is now Firebase-only, but DevArena keeps its familiar
      // six-digit recovery UX. The OTP proves control of the registered email;
      // resetPassword then changes the Firebase password from the trusted backend.
      const otp = generateAuthOtp();
      await authRepository.updateUser(user.id, {
        emailOtp: hashAuthOtp(otp),
        emailOtpExpiresAt: authOtpExpiresAt(),
      });

      const sent = await sendAuthOtpEmail(user.email, otp, "password-reset");
      if (!sent) {
        await authRepository.updateUser(user.id, { emailOtp: null, emailOtpExpiresAt: null });
        return { statusCode: 502, body: { message: "The password reset email could not be sent" } };
      }

      return {
        statusCode: 200,
        body: { message: "Password reset code sent to email", tempToken: generatePasswordResetToken(user.id) },
      };
    } catch (error: unknown) {
      return { statusCode: 500, body: { message: "Failed to process request", error: getErrorMessage(error) } };
    }
  },

  async resetPassword(input: ResetPasswordInput): Promise<AuthServiceResult> {
    try {
      const { tempToken, otp, newPassword } = input;
      if (!tempToken || !otp || !newPassword) {
        return { statusCode: 400, body: { message: "Missing required fields" } };
      }
      if (newPassword.length < 8) {
        return { statusCode: 400, body: { message: "Password must be at least 8 characters long" } };
      }

      const decoded = verifyAuthToken(tempToken);
      if (!decoded.isPasswordReset || !decoded.userId) {
        return { statusCode: 401, body: { message: "Invalid token for password reset" } };
      }

      const user = await authRepository.findUserById(decoded.userId);
      if (!user || !user.emailOtp || !user.emailOtpExpiresAt || !verifyAuthOtpHash(String(otp), user.emailOtp)) {
        return { statusCode: 400, body: { message: "Invalid OTP" } };
      }
      if (new Date() > user.emailOtpExpiresAt) {
        await authRepository.updateUser(user.id, { emailOtp: null, emailOtpExpiresAt: null });
        return { statusCode: 410, body: { message: "OTP expired" } };
      }

      let firebaseUid = user.firebaseUid;

      // Normal Firebase account: reset the password in Firebase itself.
      if (firebaseUid) {
        await updateFirebasePassword(firebaseUid, newPassword);
      } else {
        // Legacy DevArena account that has never completed its one-time Firebase
        // migration. Reuse an existing Firebase identity if one exists; otherwise
        // create the Firebase password identity now. This keeps password hashes
        // out of Neon after a successful reset.
        const existingFirebaseUser = await findFirebaseUserByEmail(user.email);
        if (existingFirebaseUser?.localId) {
          firebaseUid = existingFirebaseUser.localId;
          await updateFirebasePassword(firebaseUid, newPassword);
        } else {
          const created = await createFirebasePasswordUser({
            email: user.email,
            password: newPassword,
            displayName: user.name,
            emailVerified: true,
          });
          firebaseUid = created.uid;
        }
      }

      await authRepository.updateUser(user.id, {
        firebaseUid,
        passwordHash: null,
        isEmailVerified: true,
        emailOtp: null,
        emailOtpExpiresAt: null,
      });

      const onboarding = await getOnboardingStatus(user.id).catch(() => null);
      const pendingOnboarding = Boolean(onboarding?.required && !onboarding.complete);

      return {
        statusCode: 200,
        body: {
          message: pendingOnboarding
            ? "Password reset! Log in and you'll be guided to complete your GitHub setup."
            : "Password reset successfully. You can now log in.",
          requiresOnboarding: pendingOnboarding,
        },
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const firebaseError = firebaseServiceError(message, "Firebase could not reset this password.");
      if (firebaseError) return firebaseError;
      console.error("Password reset failed:", error);
      return { statusCode: 500, body: { message: "Failed to reset password" } };
    }
  },

  async getCurrentUser(userId: string | undefined): Promise<AuthServiceResult> {
    try {
      if (!userId) return { statusCode: 401, body: { message: "Not authenticated" } };
      const user = await authRepository.getCurrentUser(userId);
      if (!user) return { statusCode: 404, body: { message: "User not found" } };

      const usernameRequired = requiresUsername(user.username, user.usernameChosen);
      const onboarding = await getOnboardingStatus(user.id);
      const envAdmins = new Set(String(process.env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
      const isAdmin = user.role === "Admin" || user.role === "Judge" || envAdmins.has(user.email.toLowerCase());
      return {
        statusCode: 200,
        body: {
          user: {
            ...user,
            username: usernameRequired ? "" : user.username,
            requiresUsername: usernameRequired,
            requiresOnboarding: onboarding.required,
            onboarding,
            isAdmin,
          },
        },
      };
    } catch (error: unknown) {
      return { statusCode: 500, body: { message: "Failed to fetch user", error: getErrorMessage(error) } };
    }
  },

  async usernameAvailability(userId: string | undefined, rawUsername: unknown): Promise<AuthServiceResult> {
    try {
      if (!userId) return { statusCode: 401, body: { message: "Not authenticated" } };
      const username = normalizeUsername(rawUsername);
      const validationError = validateUsername(username);
      if (validationError) {
        return { statusCode: 200, body: { available: false, username, message: validationError } };
      }

      const existing = await authRepository.findUserByUsername(username);
      const available = !existing || existing.id === userId;
      return {
        statusCode: 200,
        body: { available, username, message: available ? "Username is available" : "Username already taken" },
      };
    } catch (error: unknown) {
      return { statusCode: 500, body: { message: "Could not check username", error: getErrorMessage(error) } };
    }
  },

  async chooseUsername(userId: string | undefined, input: ChooseUsernameInput): Promise<AuthServiceResult> {
    try {
      if (!userId) return { statusCode: 401, body: { message: "Not authenticated" } };
      const currentUser = await authRepository.findUserById(userId);
      if (!currentUser) return { statusCode: 404, body: { message: "User not found" } };
      if (!requiresUsername(currentUser.username, currentUser.usernameChosen)) {
        return { statusCode: 409, body: { message: "Your username is already permanent" } };
      }

      const username = normalizeUsername(input.username);
      const validationError = validateUsername(username);
      if (validationError) return { statusCode: 400, body: { message: validationError } };

      const existing = await authRepository.findUserByUsername(username);
      if (existing && existing.id !== userId) {
        return { statusCode: 409, body: { message: "Username already taken" } };
      }

      const user = await authRepository.updateUser(userId, { username, usernameChosen: true });
      return { statusCode: 200, body: { message: "Username saved", user: createUserPayload(user) } };
    } catch (error: unknown) {
      const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (errorCode === "P2002") return { statusCode: 409, body: { message: "Username already taken" } };
      return { statusCode: 500, body: { message: "Could not save username", error: getErrorMessage(error) } };
    }
  },

  async completeOnboarding(userId: string | undefined): Promise<AuthServiceResult> {
    try {
      if (!userId) return { statusCode: 401, body: { message: "Not authenticated" } };
      const onboarding = await finalizeOnboarding(userId);
      return { statusCode: 200, body: { message: "Onboarding completed", onboarding } };
    } catch (error: unknown) {
      const statusCode = error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
      return {
        statusCode,
        body: { message: error instanceof Error ? error.message : "Could not complete onboarding" },
      };
    }
  },

  async prepareFirebaseMigration(input: PrepareFirebaseMigrationInput): Promise<AuthServiceResult> {
    try {
      const email = String(input.email || "").trim().toLowerCase();
      const password = String(input.password || "");
      if (!email || !password) {
        return { statusCode: 400, body: { message: "Email and password are required" } };
      }

      const user = await authRepository.findUserByEmail(email);
      if (!user || !user.passwordHash || user.firebaseUid) {
        return { statusCode: 401, body: { message: "Invalid email or password" } };
      }
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        return { statusCode: 401, body: { message: "Invalid email or password" } };
      }

      return {
        statusCode: 200,
        body: {
          migrationToken: generateFirebaseMigrationToken(user.id, user.email),
          displayName: user.name,
          message: "Legacy DevArena credentials verified. Firebase migration can continue.",
        },
      };
    } catch (error: unknown) {
      console.error("Firebase migration preparation failed:", error);
      return { statusCode: 500, body: { message: "Could not prepare the Firebase account migration" } };
    }
  },

  async syncFirebase(input: SyncFirebaseInput): Promise<AuthServiceResult> {
    try {
      const identity = await verifyFirebaseIdToken(String(input.idToken || ""));

      // Password-based Firebase identities are never allowed to create a new
      // DevArena/Neon account through this generic sync endpoint. New password
      // accounts must complete /register -> DevArena OTP -> verify-auth-otp.
      if (identity.provider === "password") {
        const existingByUid = await prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
        const existingByEmail = await authRepository.findUserByEmail(identity.email);
        if (!existingByUid && !existingByEmail) {
          return {
            statusCode: 403,
            body: {
              code: "SIGNUP_OTP_REQUIRED",
              message: "Complete email signup and the DevArena verification code before a session can be created.",
            },
          };
        }
      }

      let migrationUserId: string | undefined;
      if (input.migrationToken) {
        const migration = verifyAuthToken(input.migrationToken);
        if (
          !migration.isFirebaseMigration ||
          !migration.userId ||
          !migration.firebaseMigrationEmail ||
          migration.firebaseMigrationEmail.toLowerCase() !== identity.email.toLowerCase()
        ) {
          return { statusCode: 401, body: { message: "The Firebase migration proof is invalid or expired." } };
        }
        migrationUserId = migration.userId;
      }

      const user = await authRepository.upsertFirebaseUser({
        firebaseUid: identity.uid,
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: String(input.displayName || identity.displayName || "").trim(),
        photoURL: input.photoURL || identity.photoURL,
        provider: identity.provider,
        acceptLegal: input.acceptLegal === true,
        migrationUserId,
        // Social-provider recovery behavior stays unchanged. Password identities
        // must never create a DevArena account through sync-firebase because
        // signup has to pass the DevArena email OTP first.
        allowOrphanRecovery: identity.provider !== "password" && input.acceptLegal !== true,
      });

      // A Firebase password session alone is not enough to bypass DevArena OTP.
      // This path is only used to restore a previously verified session while
      // its 15-day OTP grace period is still valid.
      if (identity.provider === "password" && (!user.isEmailVerified || !isWithinOtpGrace(user.lastOtpVerifiedAt))) {
        return {
          statusCode: 401,
          body: {
            code: "AUTH_OTP_REQUIRED",
            message: "Email verification is required again. Sign in to receive a new DevArena code.",
          },
        };
      }

      const token = generateAuthToken(user.id, input.remember !== false);
      return {
        statusCode: 200,
        body: { message: "Firebase identity verified and synced", token, user: createUserPayload(user) },
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error("Error syncing Firebase user:", message);

      if (message === "LEGAL_ACCEPTANCE_REQUIRED") {
        return {
          statusCode: 403,
          body: {
            code: "LEGAL_ACCEPTANCE_REQUIRED",
            message: "No DevArena account exists for this login. Create an account from Sign up and accept the Terms of Service and Privacy Policy first.",
          },
        };
      }
      if (message === "FIREBASE_MIGRATION_REQUIRED") {
        return {
          statusCode: 409,
          body: {
            code: "FIREBASE_MIGRATION_REQUIRED",
            message: "This DevArena account predates Firebase password authentication. Sign in with your existing password once to migrate it securely.",
          },
        };
      }
      if (message === "FIREBASE_IDENTITY_CONFLICT") {
        return {
          statusCode: 409,
          body: { code: "FIREBASE_IDENTITY_CONFLICT", message: "This email is already linked to another Firebase identity." },
        };
      }
      if (message === "FIREBASE_PROJECT_ID_NOT_CONFIGURED") {
        return {
          statusCode: 503,
          body: { code: "FIREBASE_NOT_CONFIGURED", message: "Firebase token verification is not configured on the DevArena backend." },
        };
      }
      if (message.startsWith("FIREBASE_CERT_FETCH_FAILED")) {
        return {
          statusCode: 503,
          body: { code: "FIREBASE_VERIFICATION_UNAVAILABLE", message: "Firebase verification is temporarily unavailable. Try again." },
        };
      }
      if (message.includes("jwt") || message.startsWith("FIREBASE_")) {
        return {
          statusCode: 401,
          body: { code: "FIREBASE_TOKEN_INVALID", message: "Firebase sign-in could not be verified. Please sign in again." },
        };
      }
      return { statusCode: 500, body: { message: "Failed to sync Firebase user" } };
    }
  },
};
