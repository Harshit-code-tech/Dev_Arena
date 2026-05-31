import type { Request, Response } from "express";
import { prisma } from "../db";

//Public

/**
 * GET /api/blog?page=1&limit=10
 * Returns published (non-draft) blog posts, newest first.
 */
export const getPublishedPosts = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            prisma.blogPost.findMany({
                where: { isDraft: false },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: { id: true, name: true, avatarUrl: true },
                    },
                },
            }),
            prisma.blogPost.count({ where: { isDraft: false } }),
        ]);

        res.status(200).json({
            success: true,
            data: posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("getPublishedPosts error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch posts" });
    }
};

//Auth required

/**
 * GET /api/blog/drafts
 * Returns drafts belonging to the current user.
 */
export const getUserDrafts = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;

        const drafts = await prisma.blogPost.findMany({
            where: { authorId: userId, isDraft: true },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                title: true,
                content: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.status(200).json({ success: true, data: drafts });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("getUserDrafts error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch drafts" });
    }
};

/**
 * POST /api/blog
 * Body: { title, content, isDraft? }
 * Creates a new blog post or draft.
 */
export const createPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { title, content, isDraft } = req.body;

        if (!title || !content) {
            res.status(400).json({ success: false, message: "Title and content are required" });
            return;
        }

        const post = await prisma.blogPost.create({
            data: {
                authorId: userId,
                title,
                content,
                isDraft: isDraft === true,
            },
            select: {
                id: true,
                title: true,
                content: true,
                isDraft: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: { id: true, name: true },
                },
            },
        });

        res.status(201).json({ success: true, data: post });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("createPost error:", message);
        res.status(500).json({ success: false, message: "Failed to create post" });
    }
};

/**
 * PUT /api/blog/:id
 * Body: { title?, content?, isDraft? }
 * Updates a post. Only the author can edit.
 */
export const updatePost = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const id = req.params.id as string;
        const { title, content, isDraft } = req.body;

        const existing = await prisma.blogPost.findUnique({ where: { id } });

        if (!existing) {
            res.status(404).json({ success: false, message: "Post not found" });
            return;
        }

        if (existing.authorId !== userId) {
            res.status(403).json({ success: false, message: "You can only edit your own posts" });
            return;
        }

        const updated = await prisma.blogPost.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(content !== undefined && { content }),
                ...(isDraft !== undefined && { isDraft }),
            },
            select: {
                id: true,
                title: true,
                content: true,
                isDraft: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("updatePost error:", message);
        res.status(500).json({ success: false, message: "Failed to update post" });
    }
};

/**
 * DELETE /api/blog/:id
 * Deletes a post. Only the author can delete.
 */
export const deletePost = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const id = req.params.id as string;

        const existing = await prisma.blogPost.findUnique({ where: { id } });

        if (!existing) {
            res.status(404).json({ success: false, message: "Post not found" });
            return;
        }

        if (existing.authorId !== userId) {
            res.status(403).json({ success: false, message: "You can only delete your own posts" });
            return;
        }

        await prisma.blogPost.delete({ where: { id } });

        res.status(200).json({ success: true, message: "Post deleted" });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("deletePost error:", message);
        res.status(500).json({ success: false, message: "Failed to delete post" });
    }
};

/**
 * PUT /api/blog/:id/publish
 * Converts a draft to a published post. Only the author can publish.
 */
export const publishDraft = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const id = req.params.id as string;

        const existing = await prisma.blogPost.findUnique({ where: { id } });

        if (!existing) {
            res.status(404).json({ success: false, message: "Post not found" });
            return;
        }

        if (existing.authorId !== userId) {
            res.status(403).json({ success: false, message: "You can only publish your own drafts" });
            return;
        }

        if (!existing.isDraft) {
            res.status(400).json({ success: false, message: "This post is already published" });
            return;
        }

        const published = await prisma.blogPost.update({
            where: { id },
            data: { isDraft: false },
            select: {
                id: true,
                title: true,
                content: true,
                isDraft: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: { id: true, name: true },
                },
            },
        });

        res.status(200).json({ success: true, data: published });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("publishDraft error:", message);
        res.status(500).json({ success: false, message: "Failed to publish draft" });
    }
};
