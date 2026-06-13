import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// POST /api/auth/register
router.post("/register", authController.register);

// POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/forgot-password
router.post("/forgot-password", authController.forgotPassword);

// POST /api/auth/sync-firebase
router.post("/sync-firebase", authController.syncFirebase);

// POST /api/auth/setup-2fa
router.post("/setup-2fa", authController.setup2FA);

// POST /api/auth/verify-2fa
router.post("/verify-2fa", authController.verify2FA);

// POST /api/auth/send-otp
router.post("/send-otp", authController.sendOTPController);

// POST /api/auth/verify-otp
router.post("/verify-otp", authController.verifyOTP);

// POST /api/auth/forgot-password
router.post("/forgot-password", authController.forgotPassword);

// POST /api/auth/reset-password
router.post("/reset-password", authController.resetPassword);

// GET /api/auth/me (Protected route to get current user based on Custom JWT)
router.get("/me", protect, authController.getCurrentUser);

export default router;
