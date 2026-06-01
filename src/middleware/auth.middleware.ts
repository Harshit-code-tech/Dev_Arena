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
    req.user = { id: "2fd0345b-50e0-4c1b-beb2-2cf152feb23c", email: "test@devarena.dev", name: "Harshit Ghosh" };
    next();
};
