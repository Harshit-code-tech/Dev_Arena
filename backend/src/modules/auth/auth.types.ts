export type AuthServiceResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

export type RegisterInput = {
  idToken?: string;
  name?: string;
  acceptLegal?: boolean;
};

export type LoginInput = {
  idToken?: string;
  remember?: boolean;
  migrationToken?: string;
};

export type VerifyAuthOtpInput = {
  tempToken?: string;
  otp?: string;
  idToken?: string;
};

export type ResendAuthOtpInput = {
  tempToken?: string;
};

export type ForgotPasswordInput = {
  email?: string;
};

export type ResetPasswordInput = {
  tempToken?: string;
  otp?: string;
  newPassword?: string;
};

export type SyncFirebaseInput = {
  idToken?: string;
  provider?: string;
  displayName?: string;
  photoURL?: string | null;
  acceptLegal?: boolean;
  remember?: boolean;
  migrationToken?: string;
};

export type PrepareFirebaseMigrationInput = {
  email?: string;
  password?: string;
};

export type ChooseUsernameInput = {
  username?: string;
};
