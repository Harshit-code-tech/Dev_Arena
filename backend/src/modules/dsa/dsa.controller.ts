import type { Request, Response } from "express";
import { dsaService } from "./dsa.service";

// Scoring: Easy = 1pt, Medium = 3pt, Hard = 5pt
// Rules: edit/delete only within 24 hours of creation

export const getLogs = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(dsaService.getLogs());
};

export const createLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(dsaService.createLog());
};

export const updateLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(dsaService.updateLog());
};

export const deleteLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(dsaService.deleteLog());
};
