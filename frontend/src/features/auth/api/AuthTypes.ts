import type { User as FirebaseUser } from "firebase/auth";

export type SocialAuthProvider = "google" | "github";
export type SocialAuthAction = "login" | "signup";

export interface PasswordStrength {
  score: number;
  label: string;
}

export interface EmailLoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface EmailLoginResult {
  token?: string;
  requires2FA?: boolean;
  tempToken?: string;
  verifyGrid: string[];
  deviceToken?: string;
}

export interface EmailSignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreeTerms: boolean;
  passwordStrength: PasswordStrength;
}

export interface EmailSignupResult {
  token: string;
}

export interface SocialAuthResult {
  token?: string;
  user: FirebaseUser;
}

export interface BackendAuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  isTwoFactorEnabled?: boolean;
}

export type AppUser = FirebaseUser | BackendAuthUser;

export interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
}

export interface ApiErrorResponse {
  message?: string;
}

export interface BackendMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isTwoFactorEnabled?: boolean;
  };
}

export interface ForgotPasswordResponse {
  message?: string;
  tempToken: string;
}

export interface TwoFactorVerificationResponse {
  token: string;
  deviceToken?: string;
}

export interface ResetPasswordInput {
  tempToken: string;
  otp: string;
  newPassword: string;
}

export interface Color2FAProps {
  isSetup?: boolean;
  onSetupComplete?: () => void;
  tempToken?: string;
  verifyGrid?: string[];
  onVerifySuccess?: (token: string, deviceToken?: string) => void;
}

export type Color2FAViewMode = "grid" | "otp_confirm" | "otp_verify";

export interface ForgotPasswordModalProps {
  onClose: () => void;
}

export type ForgotPasswordStep = "email" | "otp_and_reset";
