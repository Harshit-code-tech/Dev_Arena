import type { Request, Response } from "express";
import { practiceService } from "./practice.service";

// Scoring: Revision = 2pt, Concept explanation = 3pt
// Rules: edit/delete only within 24 hours of creation

export const getLogs = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(practiceService.getLogs());
};

export const createLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(practiceService.createLog());
};

export const updateLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(practiceService.updateLog());
};

export const deleteLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(practiceService.deleteLog());
};
