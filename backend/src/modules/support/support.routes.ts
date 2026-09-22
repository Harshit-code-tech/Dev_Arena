import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitSupportMessage } from "./support.controller";

const router = Router();

const supportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many support messages. Please wait before trying again." },
});

// Public — no auth required. Rate-limited to 5 per hour per IP.
router.post("/", supportLimiter, submitSupportMessage);

export default router;
