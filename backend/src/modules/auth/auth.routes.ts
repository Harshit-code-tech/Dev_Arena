import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "./auth.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts. Try again after 15 minutes." },
});

const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: "Too many verification-code requests. Try again later." },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: { message: "Too many verification attempts. Try again after 15 minutes." },
});

router.post("/register", otpRequestLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/verify-auth-otp", otpVerifyLimiter, authController.verifyAuthOtp);
router.post("/resend-auth-otp", otpRequestLimiter, authController.resendAuthOtp);
router.post("/prepare-firebase-migration", loginLimiter, authController.prepareFirebaseMigration);
router.post("/sync-firebase", authController.syncFirebase);
router.post("/forgot-password", otpRequestLimiter, authController.forgotPassword);
router.post("/reset-password", otpVerifyLimiter, authController.resetPassword);
router.get("/me", protect, authController.getCurrentUser);
router.get("/username-availability", protect, authController.usernameAvailability);
router.post("/choose-username", protect, authController.chooseUsername);
router.post("/complete-onboarding", protect, authController.completeOnboarding);

export default router;
