import type { Request, Response } from "express";
import { aiService } from "./ai.service";
import { sendTrackingError } from "../../shared/utils/tracking";
import type { RivalRoastInput, GenerateChallengeInput } from "./ai.types";

function userId(req: Request): string {
    return req.user?.id ?? "";
}

// POST /api/ai/rival-roast
// Body: { rivalId: string }
// Returns: { message, rivalName, yourScore, rivalScore }
export const rivalRoast = async (req: Request, res: Response): Promise<void> => {
    try {
        const { rivalId } = req.body as RivalRoastInput;
        if (!rivalId) {
            res.status(400).json({ success: false, message: "rivalId is required." });
            return;
        }
        const data = await aiService.generateRivalRoast(userId(req), rivalId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

// POST /api/ai/generate-challenge   (admin only)
// Body: { topic: string, difficulty?: string }
// Returns: GeneratedTask
export const generateChallenge = async (req: Request, res: Response): Promise<void> => {
    try {
        const { topic, difficulty } = req.body as GenerateChallengeInput;
        if (!topic || !String(topic).trim()) {
            res.status(400).json({ success: false, message: "topic is required." });
            return;
        }
        const data = await aiService.generateChallengeTask({ topic: String(topic).trim(), difficulty });
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};
