import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendOTP } from "../utils/email";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// Helper to generate JWT
const generateToken = (userId: string) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "15d" });
};

// ── REGISTER ──────────────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        // 1. Missing fields check
        if (!email || !password || !name) {
            res.status(400).json({ message: "Name, email, and password are required" });
            return;
        }

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();

        // 2. Email Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            res.status(400).json({ message: "Invalid email format" });
            return;
        }

        // 3. Password Strength Validation
        if (password.length < 8) {
            res.status(400).json({ message: "Password must be at least 8 characters long" });
            return;
        }

        // 4. Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
        if (existingUser) {
            res.status(409).json({ message: "An account with this email already exists" });
            return;
        }

        // 5. Hash password and create
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email: trimmedEmail, passwordHash, name: trimmedName },
        });

        const token = generateToken(user.id);
        res.status(201).json({ message: "Registered successfully", token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: "An unexpected error occurred during registration", error: error.message });
    }
};

// ── LOGIN ─────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, deviceToken } = req.body;

        // 1. Missing fields check
        if (!email || !password) {
            res.status(400).json({ message: "Email and password are required" });
            return;
        }

        const trimmedEmail = email.trim().toLowerCase();

        // 2. Fetch User
        const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });

        // 3. Account existence and credential check
        // If passwordHash is null, they signed up with Google/GitHub and never set a manual password
        if (!user || !user.passwordHash) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // 4. Verify Password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Check if device is trusted
        let isTrustedDevice = false;
        if (deviceToken) {
            try {
                const decodedDevice = jwt.verify(deviceToken, JWT_SECRET) as any;
                if (decodedDevice.userId === user.id && decodedDevice.isDeviceToken) {
                    isTrustedDevice = true;
                }
            } catch (err) {
                // Invalid or expired device token, ignore and proceed to 2FA
            }
        }

        // 5. If 2FA is enabled and device is not trusted, require second factor
        if (user.isTwoFactorEnabled && !isTrustedDevice) {
            const tempToken = jwt.sign(
                { userId: user.id, is2FaPending: true, rememberDevice: req.body.remember === true },
                JWT_SECRET,
                { expiresIn: "10m" }
            );

            // Generate the secure 9-color grid for the frontend
            const MASTER_COLOR_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
            const secretColors = user.twoFactorColorSequence || [];
            const remainingColors = MASTER_COLOR_PALETTE.filter(c => !secretColors.includes(c));

            // Shuffle remaining and pick enough to make 9 total
            for (let i = remainingColors.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remainingColors[i], remainingColors[j]] = [remainingColors[j], remainingColors[i]];
            }
            const fillers = remainingColors.slice(0, 9 - secretColors.length);

            const gridPool = [...secretColors, ...fillers];
            // Shuffle the final 9-grid
            for (let i = gridPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [gridPool[i], gridPool[j]] = [gridPool[j], gridPool[i]];
            }

            res.status(200).json({
                requires2FA: true,
                tempToken,
                verifyGrid: gridPool,
                message: "2FA challenge required"
            });
            return;
        }

        // 6. Complete Login
        const token = generateToken(user.id);
        res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "An unexpected error occurred during login", error: error.message });
    }
};

// ── SETUP 2FA ─────────────────────────────────────────────────
export const setup2FA = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, colorSequence } = req.body;
        if (!userId || !colorSequence || colorSequence.length !== 3) {
            res.status(400).json({ message: "Invalid data" });
            return;
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                isTwoFactorEnabled: true,
                twoFactorColorSequence: colorSequence
            }
        });

        res.status(200).json({ message: "2FA Setup complete" });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to setup 2FA", error: error.message });
    }
};

// ── VERIFY 2FA (COLOR GRID) ───────────────────────────────────
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tempToken, attemptSequence } = req.body;

        // Decode temp token
        const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
        if (!decoded.is2FaPending) {
            res.status(401).json({ message: "Invalid token" });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || !user.isTwoFactorEnabled) {
            res.status(400).json({ message: "2FA not configured" });
            return;
        }

        // Compare arrays
        const isValid = JSON.stringify(user.twoFactorColorSequence) === JSON.stringify(attemptSequence);
        if (!isValid) {
            res.status(400).json({ message: "Incorrect sequence" });
            return;
        }

        // Generate real token
        const token = generateToken(user.id);

        // Generate device token if they requested to remember the device
        let deviceToken = undefined;
        if (decoded.rememberDevice) {
            deviceToken = jwt.sign({ userId: user.id, isDeviceToken: true }, JWT_SECRET, { expiresIn: "15d" });
        }

        res.status(200).json({ token, deviceToken, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
        res.status(401).json({ message: "2FA Verification failed", error: error.message });
    }
};

// ── MFA FALLBACK: SEND EMAIL OTP ──────────────────────────────
export const sendOTPController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tempToken, confirmEmail } = req.body;

        if (!confirmEmail) {
            res.status(400).json({ message: "Please provide your email address for verification" });
            return;
        }

        const decoded = jwt.verify(tempToken, JWT_SECRET) as any;

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Security check: Ensure they typed the correct email associated with the account
        if (user.email !== confirmEmail.trim().toLowerCase()) {
            res.status(400).json({ message: "Incorrect email address provided" });
            return;
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.user.update({
            where: { id: user.id },
            data: { emailOtp: otp, emailOtpExpiresAt: expiresAt }
        });

        const sent = await sendOTP(user.email, otp);
        if (sent) {
            res.status(200).json({ message: "OTP sent to email" });
        } else {
            res.status(500).json({ message: "Failed to send email" });
        }
    } catch (error: any) {
        res.status(500).json({ message: "Failed to process OTP", error: error.message });
    }
};

// ── MFA FALLBACK: VERIFY OTP ──────────────────────────────────
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tempToken, otp } = req.body;
        const decoded = jwt.verify(tempToken, JWT_SECRET) as any;

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || user.emailOtp !== otp || !user.emailOtpExpiresAt) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }

        if (new Date() > user.emailOtpExpiresAt) {
            res.status(400).json({ message: "OTP Expired" });
            return;
        }

        // Clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: { emailOtp: null, emailOtpExpiresAt: null }
        });

        // Generate real token
        const token = generateToken(user.id);

        // Generate device token if they requested to remember the device
        let deviceToken = undefined;
        if (decoded.rememberDevice) {
            deviceToken = jwt.sign({ userId: user.id, isDeviceToken: true }, JWT_SECRET, { expiresIn: "15d" });
        }

        res.status(200).json({ token, deviceToken, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to verify OTP", error: error.message });
    }
};

// ── FORGOT PASSWORD ─────────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }

        const trimmedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });

        if (!user) {
            res.status(404).json({ message: "Email is not registered with us" });
            return;
        }

        if (!user.passwordHash) {
            res.status(400).json({ message: "This email is associated with a Google/GitHub account. Please log in using that method." });
            return;
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await prisma.user.update({
            where: { id: user.id },
            data: { emailOtp: otp, emailOtpExpiresAt: expiresAt }
        });

        const sent = await sendOTP(user.email, otp);
        if (sent) {
            // Issue a specific token for the reset flow
            const tempToken = jwt.sign({ userId: user.id, isPasswordReset: true }, JWT_SECRET, { expiresIn: "10m" });
            res.status(200).json({ message: "Password reset OTP sent to email", tempToken });
        } else {
            res.status(500).json({ message: "Failed to send email" });
        }
    } catch (error: any) {
        res.status(500).json({ message: "Failed to process request", error: error.message });
    }
};

// ── RESET PASSWORD ────────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tempToken, otp, newPassword } = req.body;

        if (!tempToken || !otp || !newPassword) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        if (newPassword.length < 8) {
            res.status(400).json({ message: "Password must be at least 8 characters long" });
            return;
        }

        const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
        if (!decoded.isPasswordReset) {
            res.status(401).json({ message: "Invalid token for password reset" });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || user.emailOtp !== otp || !user.emailOtpExpiresAt) {
            res.status(400).json({ message: "Invalid OTP" });
            return;
        }

        if (new Date() > user.emailOtpExpiresAt) {
            res.status(400).json({ message: "OTP Expired" });
            return;
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password and clear OTP/2FA (since they might have forgotten 2FA)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                emailOtp: null,
                emailOtpExpiresAt: null,
                isTwoFactorEnabled: false, // Optional: clear 2FA so they don't get locked out
                twoFactorColorSequence: []
            }
        });

        res.status(200).json({ message: "Password reset successfully. You can now log in." });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to reset password", error: error.message });
    }
};

// ── GET CURRENT USER (For AuthContext) ────────────────────────
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.id) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, name: true, avatarUrl: true, isTwoFactorEnabled: true }
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({ user });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to fetch user", error: error.message });
    }
};

// ── SYNC FIREBASE (Google/GitHub Login) ───────────────────────
export const syncFirebase = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uid, email, displayName, photoURL, provider } = req.body;

        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }

        // Upsert user into Neon database
        // Social logins leave passwordHash as null
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                name: displayName || email.split("@")[0],
                avatarUrl: photoURL || null,
            },
            create: {
                name: displayName || email.split("@")[0],
                email,
                avatarUrl: photoURL || null,
                isEmailVerified: true,
            },
        });

        // Generate Custom JWT for this Firebase user so the rest of the app relies 100% on Neon JWTs
        const token = generateToken(user.id);

        res.status(200).json({ message: "User synced successfully", token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error: any) {
        console.error("Error syncing firebase user:", error);
        res.status(500).json({ message: "Failed to sync user", error: error.message });
    }
};
