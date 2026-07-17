import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

export type AuthTokenPayload = {
    userId: string;
    is2FaPending?: boolean;
    rememberDevice?: boolean;
    isDeviceToken?: boolean;
    isPasswordReset?: boolean;
};

export function generateAuthToken(userId: string) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "15d" });
}

export function generateDeviceToken(userId: string) {
    return jwt.sign({ userId, isDeviceToken: true }, JWT_SECRET, { expiresIn: "15d" });
}

export function generateTwoFactorToken(userId: string, rememberDevice: boolean) {
    return jwt.sign(
        { userId, is2FaPending: true, rememberDevice },
        JWT_SECRET,
        { expiresIn: "10m" },
    );
}

export function generatePasswordResetToken(userId: string) {
    return jwt.sign({ userId, isPasswordReset: true }, JWT_SECRET, { expiresIn: "10m" });
}

export function verifyAuthToken(token: string) {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
