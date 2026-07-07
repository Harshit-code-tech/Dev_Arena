export type AuthServiceResult = {
    statusCode: number;
    body: Record<string, unknown>;
};

export type RegisterInput = {
    email?: string;
    password?: string;
    name?: string;
};

export type LoginInput = {
    email?: string;
    password?: string;
    deviceToken?: string;
    remember?: boolean;
};

export type Setup2FAInput = {
    userId?: string;
    colorSequence?: string[];
};

export type Verify2FAInput = {
    tempToken?: string;
    attemptSequence?: string[];
};

export type SendOtpInput = {
    tempToken?: string;
    confirmEmail?: string;
};

export type VerifyOtpInput = {
    tempToken?: string;
    otp?: string;
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
    uid?: string;
    email?: string;
    displayName?: string;
    photoURL?: string | null;
    provider?: string;
};
