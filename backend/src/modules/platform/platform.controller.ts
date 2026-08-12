import type { Request, Response } from "express";
import { platformService } from "./platform.service";

export const getPulse = async (_req: Request, res: Response): Promise<void> => {
    try {
        const data = await platformService.getPulse();
        res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : "Could not load platform statistics.",
        });
    }
};
