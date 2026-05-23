import type { Request, Response } from "express";

// Scoring: Revision = 2pt, Concept explanation = 3pt
// Rules: edit/delete only within 24 hours of creation

export const getLogs = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const createLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const updateLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const deleteLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};
