import type { Request, Response } from "express";
import { sendTrackingError } from "../../shared/utils/tracking";
import { leaderboardService } from "./leaderboard.service";

function requireUserId(req: Request) {
    return req.user?.id || null;
}

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = requireUserId(req);
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authenticated" });
            return;
        }

        const limit = Number(req.query.limit || 10);
        const data = await leaderboardService.getLeaderboard(userId, limit);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const getNearby = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = requireUserId(req);
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authenticated" });
            return;
        }

        const data = await leaderboardService.getNearby(userId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};

export const searchLeaderboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = requireUserId(req);
        if (!userId) {
            res.status(401).json({ success: false, message: "Not authenticated" });
            return;
        }

        const data = await leaderboardService.search(userId, req.query.q);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};
