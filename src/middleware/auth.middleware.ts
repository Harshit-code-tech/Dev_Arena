import type { Request, Response, NextFunction } from "express";

// Extend Express Request to include our user object
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
            };
        }
    }
}

// This middleware verifies the JWT token on protected routes.
// It should attach req.user = { id, email, name } on success.

export const protect = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Placeholder - let all requests through until auth is implemented
    // REMOVE this and implement JWT verification before production
    req.user = { id: "placeholder", email: "placeholder@dev.com", name: "Dev" };
    next();
};
