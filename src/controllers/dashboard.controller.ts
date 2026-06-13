import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.id) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                dsaLogs: { select: { id: true, problemName: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
                fullstackLogs: { select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
                projectLogs: { select: { id: true, description: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
                practiceLogs: { select: { id: true, notes: true, createdAt: true }, orderBy: { createdAt: 'desc' } }
            }
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Combine logs
        const combinedLogs = [
            ...user.dsaLogs.map(l => ({ id: l.id, text: `DSA: ${l.problemName}`, createdAt: l.createdAt })),
            ...user.fullstackLogs.map(l => ({ id: l.id, text: `Fullstack: ${l.title}`, createdAt: l.createdAt })),
            ...user.projectLogs.map(l => ({ id: l.id, text: `Project: ${l.description}`, createdAt: l.createdAt })),
            ...user.practiceLogs.map(l => ({ id: l.id, text: `Practice: ${l.notes || "Completed"}`, createdAt: l.createdAt }))
        ];

        // Sort descending
        combinedLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // We return stats directly and logs separately
        const stats = {
            arenaScore: user.arenaScore,
            streak: user.streak,
            activeDays: user.activeDays,
            seasonPoints: user.seasonPoints,
            seasonNumber: user.seasonNumber,
            rank: user.rank,
            seasonStartDate: user.seasonStartDate,
            weeklyBonusClaimed: user.weeklyBonusClaimed,
            seasonBonusClaimed: user.seasonBonusClaimed
        };

        res.status(200).json({ stats, logs: combinedLogs });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to fetch dashboard data", error: error.message });
    }
};

export const updateDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.id) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }

        const {
            streak,
            activeDays,
            seasonPoints,
            rank,
            weeklyBonusClaimed,
            seasonBonusClaimed,
            seasonNumber,
            arenaScore,
            resetSeason // custom flag from frontend if season age > 14
        } = req.body;

        const updateData: any = {};
        if (streak !== undefined) updateData.streak = streak;
        if (activeDays !== undefined) updateData.activeDays = activeDays;
        if (seasonPoints !== undefined) updateData.seasonPoints = seasonPoints;
        if (rank !== undefined) updateData.rank = rank;
        if (weeklyBonusClaimed !== undefined) updateData.weeklyBonusClaimed = weeklyBonusClaimed;
        if (seasonBonusClaimed !== undefined) updateData.seasonBonusClaimed = seasonBonusClaimed;
        if (seasonNumber !== undefined) updateData.seasonNumber = seasonNumber;
        if (arenaScore !== undefined) updateData.arenaScore = arenaScore;
        
        if (resetSeason) {
            updateData.seasonStartDate = new Date();
        }

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        res.status(200).json({ message: "Dashboard updated successfully", user });
    } catch (error: any) {
        res.status(500).json({ message: "Failed to update dashboard data", error: error.message });
    }
};
