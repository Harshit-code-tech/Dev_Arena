import type { Request, Response } from "express";
import { releaseService } from "./release.service";
import type { ReleaseInput, ReleaseUpdateInput } from "./release.types";

function parsePagination(req: Request) {
    const pageParam = Number(req.query.page);
    const limitParam = Number(req.query.limit);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(50, limitParam) : 5;

    return { page, limit };
}

function hasRequiredReleaseFields(input: Partial<ReleaseInput>) {
    return Boolean(input.version && input.title && input.summary && input.releaseTag);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}

function hasInvalidChangelogSpecs(input: Partial<ReleaseInput>) {
    return input.changelogSpecs !== undefined && !isStringArray(input.changelogSpecs);
}

// Public

/**
 * GET /api/releases?page=1&limit=5
 * Returns all releases, newest first, paginated.
 */
export const getReleases = async (req: Request, res: Response): Promise<void> => {
    try {
        const { releases, pagination } = await releaseService.listReleases(parsePagination(req));

        res.status(200).json({
            success: true,
            data: releases,
            pagination,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("getReleases error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch releases" });
    }
};

// Auth required

/**
 * POST /api/releases
 * Body: { version, title, summary, releaseTag, status?, changelogSpecs, releasedAt? }
 * Creates a new release entry.
 */
export const createRelease = async (req: Request, res: Response): Promise<void> => {
    try {
        const input = req.body as ReleaseInput;

        if (!hasRequiredReleaseFields(input)) {
            res.status(400).json({
                success: false,
                message: "version, title, summary, and releaseTag are required",
            });
            return;
        }

        if (hasInvalidChangelogSpecs(input)) {
            res.status(400).json({
                success: false,
                message: "changelogSpecs must be an array of strings",
            });
            return;
        }

        const release = await releaseService.createRelease(input);

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
        const input = req.body as ReleaseUpdateInput;

        const existing = await releaseService.findReleaseById(id);

        if (!existing) {
            res.status(404).json({ success: false, message: "Release not found" });
            return;
        }

        if (hasInvalidChangelogSpecs(input)) {
            res.status(400).json({
                success: false,
                message: "changelogSpecs must be an array of strings",
            });
            return;
        }

        const updated = await releaseService.updateRelease(id, input);

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

        const existing = await releaseService.findReleaseById(id);

        if (!existing) {
            res.status(404).json({ success: false, message: "Release not found" });
            return;
        }

        await releaseService.deleteRelease(id);

        res.status(200).json({ success: true, message: "Release deleted" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("deleteRelease error:", message);
        res.status(500).json({ success: false, message: "Failed to delete release" });
    }
};

/**
 * POST /api/releases/automate
 * Creates a new release entry via automated scripts.
 * Protected by AUTOMATION_SECRET environment variable instead of user auth.
 */
export const automateRelease = async (req: Request, res: Response): Promise<void> => {
    try {
        const secret = req.headers.authorization;
        if (!process.env.AUTOMATION_SECRET || secret !== `Bearer ${process.env.AUTOMATION_SECRET}`) {
            res.status(401).json({ success: false, message: "Unauthorized automation attempt" });
            return;
        }

        const input = req.body as ReleaseInput;

        if (!hasRequiredReleaseFields(input)) {
            res.status(400).json({
                success: false,
                message: "version, title, summary, and releaseTag are required",
            });
            return;
        }

        if (hasInvalidChangelogSpecs(input)) {
            res.status(400).json({
                success: false,
                message: "changelogSpecs must be an array of strings",
            });
            return;
        }

        const parsedReleasedAt = input.releasedAt !== undefined ? new Date(input.releasedAt) : undefined;
        if (parsedReleasedAt && Number.isNaN(parsedReleasedAt.getTime())) {
            res.status(400).json({
                success: false,
                message: "releasedAt must be a valid date",
            });
            return;
        }

        const release = await releaseService.createRelease({
            ...input,
            releasedAt: parsedReleasedAt,
        });

        res.status(201).json({ success: true, data: release });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("automateRelease error:", message);
        res.status(500).json({ success: false, message: "Failed to automate release" });
    }
};
