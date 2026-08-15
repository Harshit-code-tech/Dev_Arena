import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export type AuthOtpPurpose = "Signup" | "Login";

export type AuthTokenPayload = {
  userId?: string;
  authOtpChallengeId?: string;
  authOtpPurpose?: AuthOtpPurpose;
  isAuthOtpPending?: boolean;
  rememberSession?: boolean;
  isPasswordReset?: boolean;
  isFirebaseMigration?: boolean;
  firebaseMigrationEmail?: string;
};

export function generateAuthToken(userId: string, rememberSession = true) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: rememberSession ? "15d" : "1d" },
  );
}

export function generateAuthOtpToken(
  challengeId: string,
  purpose: AuthOtpPurpose,
  rememberSession = false,
) {
  return jwt.sign(
    {
      authOtpChallengeId: challengeId,
      authOtpPurpose: purpose,
      isAuthOtpPending: true,
      rememberSession,
    },
    JWT_SECRET,
    { expiresIn: "30m" },
  );
}

export function generatePasswordResetToken(userId: string) {
  return jwt.sign({ userId, isPasswordReset: true }, JWT_SECRET, { expiresIn: "10m" });
}

export function generateFirebaseMigrationToken(userId: string, email: string) {
  return jwt.sign(
    { userId, firebaseMigrationEmail: email, isFirebaseMigration: true },
    JWT_SECRET,
    { expiresIn: "10m" },
  );
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
