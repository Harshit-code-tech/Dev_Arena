import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "./auth.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many login attempts, please try again after 15 minutes" },
});

const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: "Too many OTP requests, please try again after an hour" },
});

router.post("/register", authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/forgot-password", otpLimiter, authController.forgotPassword);
router.post("/sync-firebase", authController.syncFirebase);
router.post("/setup-2fa", protect, authController.setup2FA);
router.post("/verify-2fa", authController.verify2FA);
router.post("/send-otp", otpLimiter, authController.sendOTPController);
router.post("/verify-otp", authController.verifyOTP);
router.post("/reset-password", authController.resetPassword);
router.get("/me", protect, authController.getCurrentUser);

export default router;
