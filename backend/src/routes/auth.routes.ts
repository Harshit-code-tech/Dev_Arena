import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiters for security
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per `window`
    message: { message: "Too many login attempts, please try again after 15 minutes" },
});

const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 OTP requests per hour
    message: { message: "Too many OTP requests, please try again after an hour" },
});

// POST /api/auth/register
router.post("/register", authController.register);

// POST /api/auth/login
router.post("/login", loginLimiter, authController.login);

// POST /api/auth/forgot-password
router.post("/forgot-password", authController.forgotPassword);

// POST /api/auth/sync-firebase
router.post("/sync-firebase", authController.syncFirebase);

// POST /api/auth/setup-2fa
router.post("/setup-2fa", authController.setup2FA);

// POST /api/auth/verify-2fa
router.post("/verify-2fa", authController.verify2FA);

// POST /api/auth/send-otp
router.post("/send-otp", otpLimiter, authController.sendOTPController);

// POST /api/auth/verify-otp
router.post("/verify-otp", authController.verifyOTP);

// POST /api/auth/forgot-password
router.post("/forgot-password", otpLimiter, authController.forgotPassword);

// POST /api/auth/reset-password
router.post("/reset-password", authController.resetPassword);

// GET /api/auth/me (Protected route to get current user based on Custom JWT)
router.get("/me", protect, authController.getCurrentUser);

export default router;
