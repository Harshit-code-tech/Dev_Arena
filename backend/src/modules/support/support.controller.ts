import type { Request, Response } from "express";
import { supportService } from "./support.service";

export const submitSupportMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await supportService.submitMessage(req.body as Record<string, unknown>);
        res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
        const status = (error as { statusCode?: number }).statusCode ?? 500;
        const message = error instanceof Error ? error.message : "Failed to send support message.";
        res.status(status).json({ success: false, message });
    }
};
