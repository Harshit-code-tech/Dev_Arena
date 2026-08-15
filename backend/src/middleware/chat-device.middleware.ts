import type { NextFunction, Request, Response } from "express";

import { chatSecurityService } from "../modules/player-hub/chat-security.service";

export async function requireChatDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const token = req.get("x-devarena-chat-device") || "";
    if (!userId) {
      res.status(401).json({ success: false, message: "Sign in before using secure chat." });
      return;
    }
    await chatSecurityService.verifyDevice(userId, token);
    next();
  } catch (reason) {
    const value = reason as Error & { statusCode?: number };
    res.status(value.statusCode || 500).json({ success: false, message: value.message || "Secure-chat device verification failed." });
  }
}
