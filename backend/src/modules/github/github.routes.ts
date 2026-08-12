import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../../middleware/auth.middleware";
import * as controller from "./github.controller";

const router = Router();
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many GitHub requests. Try again shortly." },
});

router.get("/callback", controller.callback);
router.get("/setup", controller.setup);
router.post("/webhook", controller.webhook);
router.use(protect, limiter);
router.get("/status", controller.status);
router.get("/tech-stack", controller.techStack);
router.post("/tech-stack/rebuild", controller.rebuildTechStack);
router.post("/connect", controller.connect);
router.post("/install", controller.install);
router.get("/repositories", controller.repositories);
router.post("/verify", controller.verify);
router.delete("/connection", controller.disconnect);

export default router;
