import type { Request, Response } from "express";
import { feedbackService } from "./feedback.service";

export async function createFeedback(req: Request, res: Response) {
  try {
    const data = await feedbackService.create(req.user?.id || "", req.body || {});
    res.status(201).json({ success: true, data });
  } catch (reason) {
    const error = reason as Error & { statusCode?: number };
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "Feedback could not be submitted." });
  }
}
