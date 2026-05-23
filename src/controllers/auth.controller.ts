import type { Request, Response } from "express";

// Required: POST /register, POST /login, POST /forgot-password

export const register = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const login = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};

export const forgotPassword = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ message: "Not implemented yet" });
};
