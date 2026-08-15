import { Router } from "express";
import rateLimit from "express-rate-limit";

import { protect } from "../../middleware/auth.middleware";
import { requireChatDevice } from "../../middleware/chat-device.middleware";
import * as controller from "./player-hub.controller";

const router = Router();
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many Player Hub actions. Try again shortly." },
});
const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Message rate limit reached. Try again shortly." },
});
const authenticatorLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many Authenticator attempts. Wait a few minutes and try again." },
});

router.use(protect);
router.get("/overview", controller.overview);
router.get("/players", controller.players);
router.get("/players/:playerId/work", controller.playerWork);
router.get("/projects", controller.projects);
router.post("/projects/:id/save", writeLimiter, controller.saveProject);
router.delete("/projects/:id/save", writeLimiter, controller.unsaveProject);

router.get("/collaborations", controller.collaborations);
router.post("/collaborations", writeLimiter, controller.createCollaboration);
router.post("/collaborations/:id/apply", writeLimiter, controller.applyCollaboration);
router.get("/collaborations/:id/applications", controller.collaborationApplications);
router.patch("/collaborations/:id/applications/:applicationId", writeLimiter, controller.collaborationApplicationStatus);
router.patch("/collaborations/:id/status", writeLimiter, controller.collaborationStatus);

router.get("/community", controller.community);
router.post("/community", writeLimiter, controller.createCommunity);
router.post("/community/:id/reaction", writeLimiter, controller.reactCommunity);
router.post("/community/:id/save", writeLimiter, controller.saveCommunity);
router.post("/community/:id/comments", writeLimiter, controller.commentCommunity);

router.get("/blocks", controller.blocks);
router.post("/blocks/:playerId", writeLimiter, controller.block);
router.delete("/blocks/:playerId", writeLimiter, controller.unblock);
router.post("/reports", writeLimiter, controller.report);

router.get("/crypto/key", controller.chatKey);
router.put("/crypto/key", writeLimiter, controller.saveChatKey);
router.post("/crypto/devices/challenge", writeLimiter, controller.chatDeviceChallenge);
router.post("/crypto/devices/register", writeLimiter, controller.registerChatDevice);
router.get("/crypto/devices", requireChatDevice, controller.chatDevices);
router.delete("/crypto/devices/:deviceId", requireChatDevice, writeLimiter, controller.revokeChatDevice);
router.get("/crypto/authenticator/status", controller.chatAuthenticatorStatus);
router.post("/crypto/authenticator/setup", authenticatorLimiter, controller.beginChatAuthenticatorSetup);
router.post("/crypto/authenticator/setup/confirm", authenticatorLimiter, controller.confirmChatAuthenticatorSetup);
router.post("/crypto/authenticator/restore", authenticatorLimiter, controller.restoreChatWithAuthenticator);

router.get("/matching/preferences", controller.matchingPreferences);
router.put("/matching/preferences", writeLimiter, controller.updateMatchingPreferences);
router.get("/matching/recommendations", controller.matchingRecommendations);
router.post("/matching/:playerId/feedback", writeLimiter, controller.matchingFeedback);

router.get("/conversations", controller.conversations);
router.post("/conversations/player/:playerId", requireChatDevice, writeLimiter, controller.createConversation);
router.get("/conversations/:id/messages", requireChatDevice, controller.messages);
router.post("/conversations/:id/messages", requireChatDevice, messageLimiter, controller.sendMessage);
router.post("/conversations/:id/typing", requireChatDevice, messageLimiter, controller.typing);
router.post("/conversations/:id/delivered", requireChatDevice, messageLimiter, controller.deliverConversation);
router.post("/conversations/:id/read", requireChatDevice, writeLimiter, controller.readConversation);
router.get("/unread", controller.unread);

export default router;
