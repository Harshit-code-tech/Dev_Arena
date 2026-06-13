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

import jwt from "jsonwebtoken";

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            res.status(401).json({ message: "Not authorized, no token provided" });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as any;
        
        // Exclude temp tokens used for 2FA
        if (decoded.is2FaPending) {
            res.status(401).json({ message: "Not authorized, 2FA pending" });
            return;
        }

        // Attach userId to request
        req.user = { id: decoded.userId, email: "", name: "" }; // You can fetch full user from DB if needed
        next();
    } catch (error) {
        res.status(401).json({ message: "Not authorized, invalid token" });
    }
};
