import bcrypt from "bcryptjs";
import { sendOTP } from "../../shared/utils/email";
import { authRepository } from "./auth.repository";
import {
    generateAuthToken,
    generateDeviceToken,
    generatePasswordResetToken,
    generateTwoFactorToken,
    verifyAuthToken,
} from "./auth.tokens";
import type {
    AuthServiceResult,
    ForgotPasswordInput,
    LoginInput,
    RegisterInput,
    ResetPasswordInput,
    SendOtpInput,
    Setup2FAInput,
    SyncFirebaseInput,
    Verify2FAInput,
    VerifyOtpInput,
} from "./auth.types";

const MASTER_COLOR_PALETTE = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#84cc16",
    "#22c55e",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#d946ef",
    "#ec4899",
];

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function createOtpExpiry() {
    return new Date(Date.now() + 10 * 60 * 1000);
}

function createUserPayload(user: { id: string; email: string; name: string }) {
    return { id: user.id, email: user.email, name: user.name };
}

function shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
}

export const authService = {
    async register(input: RegisterInput): Promise<AuthServiceResult> {
        try {
            const { email, password, name } = input;

            if (!email || !password || !name) {
                return { statusCode: 400, body: { message: "Name, email, and password are required" } };
            }

            const trimmedEmail = email.trim().toLowerCase();
            const trimmedName = name.trim();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail)) {
                return { statusCode: 400, body: { message: "Invalid email format" } };
            }

            if (password.length < 8) {
                return { statusCode: 400, body: { message: "Password must be at least 8 characters long" } };
            }

            const existingUser = await authRepository.findUserByEmail(trimmedEmail);
            if (existingUser) {
                return { statusCode: 409, body: { message: "An account with this email already exists" } };
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await authRepository.createUser({
                email: trimmedEmail,
                passwordHash,
                name: trimmedName,
            });

            const token = generateAuthToken(user.id);

            return {
                statusCode: 201,
                body: {
                    message: "Registered successfully",
                    token,
                    user: createUserPayload(user),
                },
            };
        } catch (error: unknown) {
            console.error("Registration Error:", error);
            return {
                statusCode: 500,
                body: {
                    message: "An unexpected error occurred during registration",
                    error: getErrorMessage(error),
                },
            };
        }
    },

    async login(input: LoginInput): Promise<AuthServiceResult> {
        try {
            const { email, password, deviceToken } = input;

            if (!email || !password) {
                return { statusCode: 400, body: { message: "Email and password are required" } };
            }

            const trimmedEmail = email.trim().toLowerCase();
            const user = await authRepository.findUserByEmail(trimmedEmail);

            if (!user || !user.passwordHash) {
                return { statusCode: 401, body: { message: "Invalid email or password" } };
            }

            const isValid = await bcrypt.compare(password, user.passwordHash);
            if (!isValid) {
                return { statusCode: 401, body: { message: "Invalid email or password" } };
            }

            let isTrustedDevice = false;
            if (deviceToken) {
                try {
                    const decodedDevice = verifyAuthToken(deviceToken);
                    if (decodedDevice.userId === user.id && decodedDevice.isDeviceToken) {
                        isTrustedDevice = true;
                    }
                } catch {
                    // Invalid or expired device token, ignore and proceed to 2FA.
                }
            }

            if (user.isTwoFactorEnabled && !isTrustedDevice) {
                const tempToken = generateTwoFactorToken(user.id, input.remember === true);
                const secretColors = user.twoFactorColorSequence || [];
                const remainingColors = MASTER_COLOR_PALETTE.filter((color) => !secretColors.includes(color));
                const fillers = shuffle([...remainingColors]).slice(0, 9 - secretColors.length);
                const verifyGrid = shuffle([...secretColors, ...fillers]);

                return {
                    statusCode: 200,
                    body: {
                        requires2FA: true,
                        tempToken,
                        verifyGrid,
                        message: "2FA challenge required",
                    },
                };
            }

            const token = generateAuthToken(user.id);
            return { statusCode: 200, body: { token, user: createUserPayload(user) } };
        } catch (error: unknown) {
            console.error("Login Error:", error);
            return {
                statusCode: 500,
                body: {
                    message: "An unexpected error occurred during login",
                    error: getErrorMessage(error),
                },
            };
        }
    },

    async setup2FA(input: Setup2FAInput): Promise<AuthServiceResult> {
        try {
            const { userId, colorSequence } = input;
            if (!userId || !colorSequence || colorSequence.length !== 3) {
                return { statusCode: 400, body: { message: "Invalid data" } };
            }

            await authRepository.updateUser(userId, {
                isTwoFactorEnabled: true,
                twoFactorColorSequence: colorSequence,
            });

            return { statusCode: 200, body: { message: "2FA Setup complete" } };
        } catch (error: unknown) {
            return { statusCode: 500, body: { message: "Failed to setup 2FA", error: getErrorMessage(error) } };
        }
    },

    async verify2FA(input: Verify2FAInput): Promise<AuthServiceResult> {
        try {
            const { tempToken, attemptSequence } = input;
            if (!tempToken) {
                return { statusCode: 401, body: { message: "Invalid token" } };
            }

            const decoded = verifyAuthToken(tempToken);
            if (!decoded.is2FaPending) {
                return { statusCode: 401, body: { message: "Invalid token" } };
            }

            const user = await authRepository.findUserById(decoded.userId);
            if (!user || !user.isTwoFactorEnabled) {
                return { statusCode: 400, body: { message: "2FA not configured" } };
            }

            const isValid = JSON.stringify(user.twoFactorColorSequence) === JSON.stringify(attemptSequence);
            if (!isValid) {
                return { statusCode: 400, body: { message: "Incorrect sequence" } };
            }

            const token = generateAuthToken(user.id);
            const deviceToken = decoded.rememberDevice ? generateDeviceToken(user.id) : undefined;

            return {
                statusCode: 200,
                body: { token, deviceToken, user: createUserPayload(user) },
            };
        } catch (error: unknown) {
            return { statusCode: 401, body: { message: "2FA Verification failed", error: getErrorMessage(error) } };
        }
    },

    async sendOTP(input: SendOtpInput): Promise<AuthServiceResult> {
        try {
            const { tempToken, confirmEmail } = input;

            if (!confirmEmail) {
                return { statusCode: 400, body: { message: "Please provide your email address for verification" } };
            }

            if (!tempToken) {
                return { statusCode: 500, body: { message: "Failed to process OTP", error: "jwt must be provided" } };
            }

            const decoded = verifyAuthToken(tempToken);
            const user = await authRepository.findUserById(decoded.userId);
            if (!user) {
                return { statusCode: 404, body: { message: "User not found" } };
            }

            if (user.email !== confirmEmail.trim().toLowerCase()) {
                return { statusCode: 400, body: { message: "Incorrect email address provided" } };
            }

            const otp = generateOtp();
            await authRepository.updateUser(user.id, {
                emailOtp: otp,
                emailOtpExpiresAt: createOtpExpiry(),
            });

            const sent = await sendOTP(user.email, otp);
            if (sent) {
                return { statusCode: 200, body: { message: "OTP sent to email" } };
            }

            return { statusCode: 500, body: { message: "Failed to send email" } };
        } catch (error: unknown) {
            return { statusCode: 500, body: { message: "Failed to process OTP", error: getErrorMessage(error) } };
        }
    },

    async verifyOTP(input: VerifyOtpInput): Promise<AuthServiceResult> {
        try {
            const { tempToken, otp } = input;
            if (!tempToken) {
                return { statusCode: 500, body: { message: "Failed to verify OTP", error: "jwt must be provided" } };
            }

            const decoded = verifyAuthToken(tempToken);
            const user = await authRepository.findUserById(decoded.userId);
            if (!user || user.emailOtp !== otp || !user.emailOtpExpiresAt) {
                return { statusCode: 400, body: { message: "Invalid OTP" } };
            }

            if (new Date() > user.emailOtpExpiresAt) {
                return { statusCode: 400, body: { message: "OTP Expired" } };
            }

            await authRepository.updateUser(user.id, {
                emailOtp: null,
                emailOtpExpiresAt: null,
            });

            const token = generateAuthToken(user.id);
            const deviceToken = decoded.rememberDevice ? generateDeviceToken(user.id) : undefined;

            return {
                statusCode: 200,
                body: { token, deviceToken, user: createUserPayload(user) },
            };
        } catch (error: unknown) {
            return { statusCode: 500, body: { message: "Failed to verify OTP", error: getErrorMessage(error) } };
        }
    },

    async forgotPassword(input: ForgotPasswordInput): Promise<AuthServiceResult> {
        try {
            const { email } = input;
            if (!email) {
                return { statusCode: 400, body: { message: "Email is required" } };
            }

            const trimmedEmail = email.trim().toLowerCase();
            const user = await authRepository.findUserByEmail(trimmedEmail);

            if (!user) {
                return { statusCode: 404, body: { message: "Email is not registered with us" } };
            }

            if (!user.passwordHash) {
                return {
                    statusCode: 400,
                    body: {
                        message: "This email is associated with a Google/GitHub account. Please log in using that method.",
                    },
                };
            }

            const otp = generateOtp();
            await authRepository.updateUser(user.id, {
                emailOtp: otp,
                emailOtpExpiresAt: createOtpExpiry(),
            });

            const sent = await sendOTP(user.email, otp);
            if (sent) {
                const tempToken = generatePasswordResetToken(user.id);
                return { statusCode: 200, body: { message: "Password reset OTP sent to email", tempToken } };
            }

            return { statusCode: 500, body: { message: "Failed to send email" } };
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
            if (!decoded.isPasswordReset) {
                return { statusCode: 401, body: { message: "Invalid token for password reset" } };
            }

            const user = await authRepository.findUserById(decoded.userId);
            if (!user || user.emailOtp !== otp || !user.emailOtpExpiresAt) {
                return { statusCode: 400, body: { message: "Invalid OTP" } };
            }

            if (new Date() > user.emailOtpExpiresAt) {
                return { statusCode: 400, body: { message: "OTP Expired" } };
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            await authRepository.updateUser(user.id, {
                passwordHash,
                emailOtp: null,
                emailOtpExpiresAt: null,
                isTwoFactorEnabled: false,
                twoFactorColorSequence: [],
            });

            return { statusCode: 200, body: { message: "Password reset successfully. You can now log in." } };
        } catch (error: unknown) {
            return { statusCode: 500, body: { message: "Failed to reset password", error: getErrorMessage(error) } };
        }
    },

    async getCurrentUser(userId: string | undefined): Promise<AuthServiceResult> {
        try {
            if (!userId) {
                return { statusCode: 401, body: { message: "Not authenticated" } };
            }

            const user = await authRepository.getCurrentUser(userId);

            if (!user) {
                return { statusCode: 404, body: { message: "User not found" } };
            }

            return { statusCode: 200, body: { user } };
        } catch (error: unknown) {
            return { statusCode: 500, body: { message: "Failed to fetch user", error: getErrorMessage(error) } };
        }
    },

    async syncFirebase(input: SyncFirebaseInput): Promise<AuthServiceResult> {
        try {
            const { email } = input;

            if (!email) {
                return { statusCode: 400, body: { message: "Email is required" } };
            }

            const user = await authRepository.upsertFirebaseUser({ ...input, email });
            const token = generateAuthToken(user.id);

            return {
                statusCode: 200,
                body: {
                    message: "User synced successfully",
                    token,
                    user: createUserPayload(user),
                },
            };
        } catch (error: unknown) {
            console.error("Error syncing firebase user:", error);
            return { statusCode: 500, body: { message: "Failed to sync user", error: getErrorMessage(error) } };
        }
    },
};
