import { Router } from "express";
import rateLimit from "express-rate-limit";
import { rateLimitKey } from "../../middleware/rate-limit-key";
import { protect } from "../../middleware/auth.middleware";
import { createFeedback } from "./feedback.controller";

const router = Router();
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { success: false, message: "Too many feedback submissions. Try again later." },
});

router.use(protect);
router.post("/", feedbackLimiter, createFeedback);
export default router;
