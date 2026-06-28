import type { Request, Response } from "express";

// Week: Monday 00:00 IST → Sunday 23:59 IST
// Tie-break: 1) DSA pts  2) Active days  3) Challenge score  4) Earlier last activity

export const getWeeklyLeaderboard = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const getHistory = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};
