import type { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

export const syncFirebase = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uid, email, displayName, photoURL, provider } = req.body;

        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }

        // Upsert user into Neon database
        // Social logins leave passwordHash as null
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                name: displayName || email.split("@")[0],
                avatarUrl: photoURL || null,
            },
            create: {
                name: displayName || email.split("@")[0],
                email,
                avatarUrl: photoURL || null,
                isEmailVerified: true,
            },
        });

        res.status(200).json({ message: "User synced successfully", user });
    } catch (error: any) {
        console.error("Error syncing firebase user:", error);
        res.status(500).json({ message: "Failed to sync user", error: error.message });
    }
};
