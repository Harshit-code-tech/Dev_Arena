import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../../middleware/auth.middleware";
import * as controller from "./friend.controller";

const router = Router();
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many invitations were sent. Try again later." },
});
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many player requests. Try again later." },
});

router.use(protect);
router.get("/", controller.overview);
router.get("/search", controller.search);
router.post("/invite", inviteLimiter, controller.invite);
router.post("/invites/claim", controller.claimInvite);
router.post("/request/:userId", requestLimiter, controller.request);
router.post("/requests/:id/accept", controller.accept);
router.post("/requests/:id/decline", controller.decline);
router.delete("/requests/:id", controller.cancel);
router.delete("/:friendId", controller.remove);
export default router;
