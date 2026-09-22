import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
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
import { verifyFirebaseIdToken } from "./firebase-auth.service";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requiresUsername(username: string | undefined, usernameChosen = true) {
  return usernameChosen === false || !username || username.startsWith(PENDING_USERNAME_PREFIX);
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().replace(/^@/, "");
}

/** Bcrypt cost factor — 12 is the 2025 recommended minimum (Firebase uses 8–10) */
const BCRYPT_COST = 12;

/** OTP grace period: if user verified OTP within this window, skip OTP on next login */
const OTP_GRACE_PERIOD_DAYS = 15;

/**
 * A dummy hash used for constant-time comparison when the user is not found.
 * This prevents timing attacks that could enumerate valid email addresses.
 */
const DUMMY_HASH = "$2b$12$Gv9Rf2KXxiKf9hBoRSSSxuHbqPalL8bNRJTgGMVIKBmrJq3M7cHiC";

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character (e.g. !@#$%)";
  if (password.length > 128) return "Password must be 128 characters or fewer";
  return null;
}

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

export const authService = {
  async register(input: RegisterInput): Promise<AuthServiceResult> {
    try {
      const { email, password, name, acceptLegal } = input;
      if (!email || !password || !name) {
        return { statusCode: 400, body: { message: "Name, email, and password are required" } };
      }
      if (acceptLegal !== true) {
        return { statusCode: 400, body: { message: "You must accept the Terms of Service and Privacy Policy to continue" } };
      }

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim().replace(/\s+/g, " ");
      if (trimmedName.length < 2 || trimmedName.length > 80) {
        return { statusCode: 400, body: { message: "Name must contain 2 to 80 characters" } };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return { statusCode: 400, body: { message: "Invalid email format" } };
      }
      const strengthError = validatePasswordStrength(password);
      if (strengthError) {
        return { statusCode: 400, body: { message: strengthError } };
      }
      if (await authRepository.findUserByEmail(trimmedEmail)) {
        return { statusCode: 409, body: { message: "An account with this email already exists" } };
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const { challenge, tempToken } = await createOtpChallenge({
        purpose: "Signup",
        email: trimmedEmail,
        pendingName: trimmedName,
        pendingPasswordHash: passwordHash,
        rememberSession: true,
      });

      return otpPendingResponse(challenge, tempToken, "A verification code was sent to your email");
    } catch (error: unknown) {
      console.error("Registration Error:", error);
      if (getErrorMessage(error) === "OTP_EMAIL_DELIVERY_FAILED") {
        return { statusCode: 502, body: { message: "The verification email could not be sent. Check the email service configuration and try again." } };
      }
      return { statusCode: 500, body: { message: "An unexpected error occurred during registration" } };
    }
  },

  async login(input: LoginInput): Promise<AuthServiceResult> {
    try {
      const { email, password } = input;
      if (!email || !password) {
        return { statusCode: 400, body: { message: "Email or username and password are required" } };
      }

      const identifier = email.trim().toLowerCase();
      const user = await authRepository.findUserByLoginIdentifier(identifier);

      // ── Timing-safe comparison ──────────────────────────────────────
      // Always run bcrypt.compare regardless of whether the user exists.
      // This prevents timing attacks that can enumerate valid email addresses
      // by measuring response time differences.
      const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
      const passwordMatch = await bcrypt.compare(password, hashToCheck);

      if (!user || !user.passwordHash || !passwordMatch) {
        // Increment failed attempt counter on the real user if they exist
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: { increment: 1 },
              // Lock the account for 15 minutes after 10 consecutive failures
              ...(user.failedLoginAttempts + 1 >= 10
                ? { failedLoginLockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
                : {}),
            },
          });
        }
        return { statusCode: 401, body: { message: "Invalid email, username, or password" } };
      }

      // ── Per-account lockout ─────────────────────────────────────────
      if (user.failedLoginLockedUntil && user.failedLoginLockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.failedLoginLockedUntil.getTime() - Date.now()) / 60000);
        return {
          statusCode: 429,
          body: { message: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` },
        };
      }

      // ── Reset failed attempt counter on successful password check ────────
      if (user.failedLoginAttempts > 0 || user.failedLoginLockedUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, failedLoginLockedUntil: null },
        });
      }

      // ── 15-day OTP grace period ───────────────────────────────────
      // If the user verified an OTP within the last 15 days, skip OTP and
      // issue a session token directly. This matches how Firebase handles
      // persistent sessions, while still requiring OTP after the grace period.
      if (user.lastOtpVerifiedAt) {
        const gracePeriodMs = OTP_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
        const withinGracePeriod = Date.now() - user.lastOtpVerifiedAt.getTime() < gracePeriodMs;
        if (withinGracePeriod) {
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
      }

      const { challenge, tempToken } = await createOtpChallenge({
        purpose: "Login",
        email: user.email,
        userId: user.id,
        rememberSession: input.remember === true,
      });

      return otpPendingResponse(challenge, tempToken, "Password accepted. Enter the code sent to your email to finish signing in.");
    } catch (error: unknown) {
      console.error("Login Error:", error);
      if (getErrorMessage(error) === "OTP_EMAIL_DELIVERY_FAILED") {
        return { statusCode: 502, body: { message: "The login code could not be sent. Check the email service configuration and try again." } };
      }
      return { statusCode: 500, body: { message: "An unexpected error occurred during login" } };
    }
  },

  async verifyAuthOtp(input: VerifyAuthOtpInput): Promise<AuthServiceResult> {
    try {
      const tempToken = String(input.tempToken || "");
      const otp = String(input.otp || "").trim();
      if (!tempToken || !/^\d{6}$/.test(otp)) {
        return { statusCode: 400, body: { message: "Enter the complete 6-digit verification code" } };
      }

      const decoded = parseOtpToken(tempToken);
      const challenge = await prisma.authOtpChallenge.findUnique({ where: { id: decoded.authOtpChallengeId } });
      if (!challenge || challenge.purpose !== decoded.authOtpPurpose) {
        return { statusCode: 401, body: { message: "This verification request is invalid. Start again." } };
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
        if (!challenge.pendingName || !challenge.pendingPasswordHash) {
          return { statusCode: 409, body: { message: "The signup verification is incomplete. Start again." } };
        }
        if (await authRepository.findUserByEmail(challenge.email)) {
          await prisma.authOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
          return { statusCode: 409, body: { message: "An account with this email already exists" } };
        }

        const pendingName = challenge.pendingName;
        const pendingPasswordHash = challenge.pendingPasswordHash;
        const pendingUsername = await nextPendingUsername();
        const user = await prisma.$transaction(async (tx) => {
          const claimed = await tx.authOtpChallenge.updateMany({
            where: { id: challenge.id, consumedAt: null },
            data: { consumedAt: new Date(), pendingPasswordHash: null },
          });
          if (claimed.count !== 1) throw new Error("OTP_ALREADY_CONSUMED");

          return tx.user.create({
            data: {
              email: challenge.email,
              passwordHash: pendingPasswordHash,
              name: pendingName,
              username: pendingUsername,
              usernameChosen: false,
              onboardingRequired: true,
              isEmailVerified: true,
              // Start the 15-day OTP grace period from the moment of account creation
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
            message: "Email verified and account created",
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
            // Stamp the OTP verification time to start the 15-day grace period
            lastOtpVerifiedAt: new Date(),
            // Reset any brute-force counters on successful full login
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
      if (message === "INVALID_AUTH_OTP_TOKEN" || message.includes("jwt")) {
        return { statusCode: 401, body: { message: "This verification request is invalid. Start again." } };
      }
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
      if (user.firebaseUid) {
        return {
          statusCode: 409,
          body: {
            message: "This account uses Firebase Authentication. Use the Firebase password-reset email.",
            useFirebaseReset: true,
          },
        };
      }
      if (!user.passwordHash) {
        return {
          statusCode: 400,
          body: { message: "This account does not have a legacy DevArena password. Use its connected sign-in provider." },
        };
      }

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

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await authRepository.updateUser(user.id, {
        passwordHash,
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
      return { statusCode: 500, body: { message: "Failed to reset password", error: getErrorMessage(error) } };
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
        // On login (not signup), recover orphaned Firebase identities that have no DB record
        // by creating the user silently with onboardingRequired: true.
        allowOrphanRecovery: input.acceptLegal !== true,
      });

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
