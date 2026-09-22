import type { Request, Response } from "express";
import { coachService } from "./coach.service";

function userId(req: Request) { return req.user?.id || ""; }

export const getCoachFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await coachService.getFeedback(userId(req));
        res.status(200).json({ success: true, data });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load coach feedback.";
        res.status(500).json({ success: false, message });
    }
};
