export type AuthServiceResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

export type RegisterInput = {
  email?: string;
  password?: string;
  name?: string;
  acceptLegal?: boolean;
};

export type LoginInput = {
  email?: string;
  password?: string;
  remember?: boolean;
};

export type VerifyAuthOtpInput = {
  tempToken?: string;
  otp?: string;
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
