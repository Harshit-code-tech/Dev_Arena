import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request to include our authenticated user identity.
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

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.split(" ")[1] : undefined;

    if (!token) {
      res.status(401).json({ message: "Not authorized, no token provided" });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(503).json({ message: "Server configuration error. Please contact support." });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId?: string;
      isAuthOtpPending?: boolean;
      isPasswordReset?: boolean;
    };

    if (!decoded.userId || decoded.isAuthOtpPending || decoded.isPasswordReset) {
      res.status(401).json({ message: "Not authorized, authentication verification is incomplete" });
      return;
    }

    req.user = { id: decoded.userId, email: "", name: "" };
    next();
  } catch {
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};
