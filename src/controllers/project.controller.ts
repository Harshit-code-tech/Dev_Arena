import type { Request, Response } from "express";

// Scoring: Work session = 3pt, Milestone completed = 8pt, Project completed = 20pt
// Rules: edit/delete logs only within 24 hours of creation

export const getProjects = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const createProject = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const updateProject = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const addLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const updateLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const deleteLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const addMilestone = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const updateMilestone = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};
