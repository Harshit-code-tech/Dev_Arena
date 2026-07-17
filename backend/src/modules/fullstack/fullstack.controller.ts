import type { Request, Response } from "express";
import { fullstackService } from "./fullstack.service";

// Scoring: Learning = 2pt, Building = 4pt
// Rules: edit/delete only within 24 hours of creation

export const getLogs = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(fullstackService.getLogs());
};

export const createLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(fullstackService.createLog());
};

export const updateLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(fullstackService.updateLog());
};

export const deleteLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(fullstackService.deleteLog());
};
