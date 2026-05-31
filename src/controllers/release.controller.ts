import type { Request, Response } from "express";
import { prisma } from "../db";

//Public

/**
 * GET /api/releases?page=1&limit=5
 * Returns all releases, newest first, paginated.
 */
export const getReleases = async (req: Request, res: Response): Promise<void> => {
    try {
        const pageParam = Number(req.query.page);
        const limitParam = Number(req.query.limit);
        const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
        const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(50, limitParam) : 5;
        const skip = (page - 1) * limit;

        const [releases, total] = await Promise.all([
            prisma.release.findMany({
                orderBy: { releasedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.release.count(),
        ]);

        res.status(200).json({
            success: true,
            data: releases,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("getReleases error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch releases" });
    }
};

//Auth required

/**
 * POST /api/releases
 * Body: { version, title, summary, releaseTag, status?, changelogSpecs, releasedAt? }
 * Creates a new release entry.
 */
export const createRelease = async (req: Request, res: Response): Promise<void> => {
    try {
        const { version, title, summary, releaseTag, status, changelogSpecs, releasedAt } = req.body;

        if (!version || !title || !summary || !releaseTag) {
            res.status(400).json({
                success: false,
                message: "version, title, summary, and releaseTag are required",
            });
            return;
        }

        if (changelogSpecs !== undefined && (!Array.isArray(changelogSpecs) || !changelogSpecs.every((item: unknown) => typeof item === "string"))) {
            res.status(400).json({
                success: false,
                message: "changelogSpecs must be an array of strings",
            });
            return;
        }

        const release = await prisma.release.create({
            data: {
                version,
                title,
                summary,
                releaseTag,
                status: status || "Released",
                changelogSpecs: changelogSpecs || [],
                ...(releasedAt && { releasedAt: new Date(releasedAt) }),
            },
        });

        res.status(201).json({ success: true, data: release });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("createRelease error:", message);
        res.status(500).json({ success: false, message: "Failed to create release" });
    }
};

/**
 * PUT /api/releases/:id
 * Body: { version?, title?, summary?, releaseTag?, status?, changelogSpecs?, releasedAt? }
 * Updates an existing release entry.
 */
export const updateRelease = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { version, title, summary, releaseTag, status, changelogSpecs, releasedAt } = req.body;

        const existing = await prisma.release.findUnique({ where: { id } });

        if (!existing) {
            res.status(404).json({ success: false, message: "Release not found" });
            return;
        }

        if (changelogSpecs !== undefined && (!Array.isArray(changelogSpecs) || !changelogSpecs.every((item: unknown) => typeof item === "string"))) {
            res.status(400).json({
                success: false,
                message: "changelogSpecs must be an array of strings",
            });
            return;
        }

        const updated = await prisma.release.update({
            where: { id },
            data: {
                ...(version !== undefined && { version }),
                ...(title !== undefined && { title }),
                ...(summary !== undefined && { summary }),
                ...(releaseTag !== undefined && { releaseTag }),
                ...(status !== undefined && { status }),
                ...(changelogSpecs !== undefined && { changelogSpecs }),
                ...(releasedAt !== undefined && { releasedAt: new Date(releasedAt) }),
            },
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("updateRelease error:", message);
        res.status(500).json({ success: false, message: "Failed to update release" });
    }
};

/**
 * DELETE /api/releases/:id
 * Deletes a release entry.
 */
export const deleteRelease = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;

        const existing = await prisma.release.findUnique({ where: { id } });

        if (!existing) {
            res.status(404).json({ success: false, message: "Release not found" });
            return;
        }

        await prisma.release.delete({ where: { id } });

        res.status(200).json({ success: true, message: "Release deleted" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("deleteRelease error:", message);
        res.status(500).json({ success: false, message: "Failed to delete release" });
    }
};
