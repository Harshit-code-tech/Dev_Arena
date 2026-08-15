import type { Request, Response } from "express";

import { playerHubService } from "./player-hub.service";
import { chatSecurityService } from "./chat-security.service";
import { chatTotpService } from "./chat-totp.service";
import { playerMatchingService } from "./player-matching.service";

function userId(req: Request) {
  return req.user?.id || "";
}

function fail(res: Response, reason: unknown) {
  const value = reason as Error & { statusCode?: number };
  res.status(value.statusCode || 500).json({ success: false, message: value.message || "Player Hub request failed." });
}

function action(handler: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response) => {
    try {
      res.status(status).json({ success: true, data: await handler(req) });
    } catch (reason) {
      fail(res, reason);
    }
  };
}

export const overview = action((req) => playerHubService.getOverview(userId(req)));
export const players = action((req) => playerHubService.getPlayers(userId(req), String(req.query.q || "")));
export const playerWork = action((req) => playerHubService.getPlayerWork(userId(req), String(req.params.playerId)));
export const projects = action((req) => playerHubService.getSharedProjects(userId(req)));
export const saveProject = action((req) => playerHubService.setProjectSaved(userId(req), String(req.params.id), true));
export const unsaveProject = action((req) => playerHubService.setProjectSaved(userId(req), String(req.params.id), false));
export const collaborations = action((req) => playerHubService.getCollaborations(userId(req)));
export const createCollaboration = action((req) => playerHubService.createCollaboration(userId(req), req.body || {}), 201);
export const applyCollaboration = action((req) => playerHubService.applyToCollaboration(userId(req), String(req.params.id), req.body || {}), 201);
export const collaborationApplications = action((req) => playerHubService.getCollaborationApplications(userId(req), String(req.params.id)));
export const collaborationApplicationStatus = action((req) => playerHubService.setCollaborationApplicationStatus(userId(req), String(req.params.id), String(req.params.applicationId), String(req.body?.status || "")));
export const collaborationStatus = action((req) => playerHubService.setCollaborationStatus(userId(req), String(req.params.id), String(req.body?.status || "")));
export const community = action((req) => playerHubService.getCommunityPosts(userId(req)));
export const createCommunity = action((req) => playerHubService.createCommunityPost(userId(req), req.body || {}), 201);
export const reactCommunity = action((req) => playerHubService.setCommunityReaction(userId(req), String(req.params.id), req.body?.active === true));
export const saveCommunity = action((req) => playerHubService.setCommunitySaved(userId(req), String(req.params.id), req.body?.active === true));
export const commentCommunity = action((req) => playerHubService.addCommunityComment(userId(req), String(req.params.id), req.body?.content), 201);
export const blocks = action((req) => playerHubService.getBlockedPlayers(userId(req)));
export const block = action((req) => playerHubService.setBlocked(userId(req), String(req.params.playerId), true));
export const unblock = action((req) => playerHubService.setBlocked(userId(req), String(req.params.playerId), false));
export const report = action((req) => playerHubService.createReport(userId(req), req.body || {}), 201);
export const chatKey = action((req) => playerHubService.getChatKey(userId(req)));
export const saveChatKey = action((req) => playerHubService.setChatKey(userId(req), req.body?.publicKey));
export const chatRecoveryStatus = action((req) => chatSecurityService.recoveryStatus(userId(req), req.get("x-devarena-chat-device") || undefined));
export const setupChatRecovery = action((req) => chatSecurityService.setupRecovery(userId(req), req.body || {}), 201);
export const chatRecoveryBackup = action((req) => chatSecurityService.getRecoveryBackup(userId(req)));
export const replaceChatRecoveryBackup = action((req) => chatSecurityService.replaceRecoveryBackup(userId(req), req.body || {}));
export const chatDeviceChallenge = action((req) => chatSecurityService.createDeviceChallenge(userId(req)));
export const registerChatDevice = action((req) => chatSecurityService.registerDevice(userId(req), req.body || {}), 201);
export const chatDevices = action((req) => chatSecurityService.listDevices(userId(req), req.get("x-devarena-chat-device") || undefined));
export const revokeChatDevice = action((req) => chatSecurityService.revokeDevice(userId(req), String(req.params.deviceId)));
export const chatAuthenticatorStatus = action(async (req) => ({
  ...(await chatTotpService.status(userId(req))),
  ...(await chatSecurityService.deviceStatus(userId(req), req.get("x-devarena-chat-device") || undefined)),
}));
export const beginChatAuthenticatorSetup = action((req) => chatTotpService.beginSetup(userId(req)));
export const confirmChatAuthenticatorSetup = async (req: Request, res: Response) => {
  try {
    const id = userId(req);
    const data = await chatTotpService.confirmSetup(id, req.body || {});
    await chatSecurityService.registerAuthenticatorVerifiedDevice(id, req.body || {});
    res.setHeader("Cache-Control", "no-store, private");
    res.status(201).json({ success: true, data });
  } catch (reason) {
    fail(res, reason);
  }
};
export const restoreChatWithAuthenticator = async (req: Request, res: Response) => {
  try {
    const id = userId(req);
    const data = await chatTotpService.restore(id, req.body || {});
    await chatSecurityService.registerAuthenticatorVerifiedDevice(id, req.body || {});
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Pragma", "no-cache");
    res.status(200).json({ success: true, data });
  } catch (reason) {
    fail(res, reason);
  }
};
export const chatPasskeys = action((req) => chatSecurityService.listPasskeys(userId(req)));
export const saveChatPasskey = action((req) => chatSecurityService.savePasskey(userId(req), req.body || {}), 201);
export const chatPasskeyBackup = action((req) => chatSecurityService.getPasskeyBackup(userId(req), String(req.params.credentialId)));
export const deleteChatPasskey = action((req) => chatSecurityService.deletePasskey(userId(req), String(req.params.passkeyId)));
export const createChatTransfer = action((req) => chatSecurityService.createTransferRequest(userId(req), req.body || {}), 201);
export const pendingChatTransfers = action((req) => chatSecurityService.pendingTransfers(userId(req)));
export const chatTransferStatus = action((req) => chatSecurityService.transferStatus(userId(req), String(req.params.code)));
export const approveChatTransfer = action((req) => chatSecurityService.approveTransfer(userId(req), String(req.params.transferId), req.body || {}));
export const consumeChatTransfer = action((req) => chatSecurityService.consumeTransfer(userId(req), String(req.params.code)));
export const completeChatTransfer = action((req) => chatSecurityService.completeTransfer(userId(req), String(req.params.code)));
export const matchingPreferences = action((req) => playerMatchingService.getPreferences(userId(req)));
export const updateMatchingPreferences = action((req) => playerMatchingService.updatePreferences(userId(req), req.body || {}));
export const matchingRecommendations = action((req) => playerMatchingService.recommendations(userId(req)));
export const matchingFeedback = action((req) => playerMatchingService.feedback(userId(req), String(req.params.playerId), req.body?.action));
export const conversations = action((req) => playerHubService.getConversations(userId(req)));
export const createConversation = action((req) => playerHubService.getOrCreateConversation(userId(req), String(req.params.playerId)), 201);
export const messages = action((req) => playerHubService.getMessages(userId(req), String(req.params.id), req.query.before ? String(req.query.before) : undefined));
export const sendMessage = action((req) => playerHubService.sendMessage(userId(req), String(req.params.id), req.body || {}), 201);
export const typing = action((req) => playerHubService.setTyping(userId(req), String(req.params.id), req.body?.active === true));
export const deliverConversation = action((req) => playerHubService.markConversationDelivered(userId(req), String(req.params.id)));
export const readConversation = action((req) => playerHubService.markConversationRead(userId(req), String(req.params.id)));
export const unread = action((req) => playerHubService.getUnreadCount(userId(req)));
