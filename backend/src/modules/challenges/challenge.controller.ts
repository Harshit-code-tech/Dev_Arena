import type { Request, Response } from "express";
import { challengeService } from "./challenge.service";

// Weekly challenge: conducted once per week (recommended: Sunday)
// Ranking: 1) Problems solved  2) Completion time  3) Code correctness

export const getResults = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(challengeService.getResults());
};

export const submitResult = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(challengeService.submitResult());
};
