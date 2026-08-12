import type { User as FirebaseUser } from "firebase/auth";

export type SocialAuthProvider = "google" | "github";
export type FirebaseAuthProvider = SocialAuthProvider | "password";
export type SocialAuthAction = "login" | "signup";
export type AuthOtpPurpose = "login" | "signup";

export interface PasswordStrength {
  score: number;
  label: string;
}

export interface EmailLoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface AuthOtpPendingResult {
  requiresOtp: true;
  tempToken: string;
  email: string;
  resendAfterSeconds: number;
  message?: string;
}

export interface FirebaseEmailAuthResult {
  token: string;
  requiresUsername: boolean;
  requiresOnboarding: boolean;
  user: FirebaseUser;
  message?: string;
  migratedFromLegacy?: boolean;
  // Kept optional so obsolete/dead auth screens still type-check without affecting the active flow.
  requires2FA?: boolean;
  tempToken?: string;
  verifyGrid?: string[];
}

export type EmailLoginResult = FirebaseEmailAuthResult;

export interface EmailSignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreeTerms: boolean;
  passwordStrength: PasswordStrength;
}

export type EmailSignupResult = FirebaseEmailAuthResult;

export interface AuthOtpVerificationResult {
  token: string;
  message?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    username?: string;
    requiresUsername?: boolean;
    requiresOnboarding?: boolean;
  };
}

export interface AuthOtpResendResult {
  tempToken: string;
  email: string;
  resendAfterSeconds: number;
  message?: string;
}

export interface EmailOtpChallengeProps {
  purpose: AuthOtpPurpose;
  tempToken: string;
  email: string;
  resendAfterSeconds?: number;
  onVerified: (result: AuthOtpVerificationResult) => Promise<void> | void;
  onBack: () => void;
}

export interface SocialAuthResult {
  token?: string;
  requiresUsername: boolean;
  requiresOnboarding: boolean;
  user: FirebaseUser;
}

export interface OnboardingStatus {
  required: boolean;
  complete: boolean;
  usernameComplete: boolean;
  githubConnected: boolean;
  githubInstallationConfigured: boolean;
}

export interface BackendAuthUser {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  useInitials?: boolean;
  privacyMode?: boolean;
  compactWorkspace?: boolean;
  requiresUsername?: boolean;
  requiresOnboarding?: boolean;
  onboarding?: OnboardingStatus;
  role?: "User" | "Admin" | "Judge" | "Moderator";
  isAdmin?: boolean;
}

export type AppUser = FirebaseUser | BackendAuthUser;

export interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

export interface ApiErrorResponse {
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  useFirebaseReset?: boolean;
}

export interface BackendMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    useInitials?: boolean;
    privacyMode?: boolean;
    compactWorkspace?: boolean;
    requiresUsername?: boolean;
    requiresOnboarding?: boolean;
    onboarding?: OnboardingStatus;
    role?: "User" | "Admin" | "Judge" | "Moderator";
    isAdmin?: boolean;
  };
}

export interface ForgotPasswordResponse {
  message?: string;
  tempToken?: string;
  useFirebaseReset?: boolean;
}

export interface ResetPasswordInput {
  tempToken: string;
  otp: string;
  newPassword: string;
}

export interface ForgotPasswordModalProps {
  onClose: () => void;
}

export type ForgotPasswordStep = "email" | "otp_and_reset" | "firebase_sent";
