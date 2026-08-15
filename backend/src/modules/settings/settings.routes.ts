import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../../middleware/auth.middleware";
import * as controller from "./settings.controller";

const router = Router();
const identityChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many identity verification requests. Try again later." },
});

router.use(protect);
router.get("/", controller.getSettings);
router.put("/preferences", controller.updatePreferences);
router.post("/photo", controller.updateProfilePhoto);
router.post("/identity/request", identityChangeLimiter, controller.requestIdentityChange);
router.post("/identity/confirm", controller.confirmIdentityChange);
router.get("/export", controller.exportAccount);
router.delete("/account", controller.deleteAccount);
export default router;
