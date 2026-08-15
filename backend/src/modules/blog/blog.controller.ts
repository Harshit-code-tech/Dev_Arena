import type { Request, Response } from "express";
import { blogService } from "./blog.service";
import type { BlogMutationResult, BlogPostInput, BlogPostUpdateInput } from "./blog.types";

function parsePagination(req: Request) {
    const pageParam = Number(req.query.page);
    const limitParam = Number(req.query.limit);
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(50, limitParam) : 10;

    return { page, limit };
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function sendBlogMutationResult<T>(res: Response, result: BlogMutationResult<T>, successStatus = 200) {
    if (result.status === "not_found") {
        res.status(404).json({ success: false, message: "Post not found" });
        return;
    }

    if (result.status === "forbidden") {
        res.status(403).json({ success: false, message: result.message });
        return;
    }

    if (result.status === "bad_request") {
        res.status(400).json({ success: false, message: result.message });
        return;
    }

    res.status(successStatus).json({ success: true, data: result.data });
}

// Public

export const getPublishedPosts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { posts, pagination } = await blogService.getPublishedPosts(parsePagination(req));

        res.status(200).json({
            success: true,
            data: posts,
            pagination,
        });
    } catch (error: unknown) {
        console.error("getPublishedPosts error:", getErrorMessage(error));
        res.status(500).json({ success: false, message: "Failed to fetch posts" });
    }
};

// Auth required

export const getUserDrafts = async (req: Request, res: Response): Promise<void> => {
    try {
        const drafts = await blogService.getUserDrafts(req.user!.id);

        res.status(200).json({ success: true, data: drafts });
    } catch (error: unknown) {
        console.error("getUserDrafts error:", getErrorMessage(error));
        res.status(500).json({ success: false, message: "Failed to fetch drafts" });
    }
};

export const createPost = async (req: Request, res: Response): Promise<void> => {
    try {
        const input = req.body as BlogPostInput;

        if (!input.title || !input.content) {
            res.status(400).json({ success: false, message: "Title and content are required" });
            return;
        }

        const post = await blogService.createPost(req.user!.id, input);

        res.status(201).json({ success: true, data: post });
    } catch (error: unknown) {
        console.error("createPost error:", getErrorMessage(error));
        res.status(500).json({ success: false, message: "Failed to create post" });
    }
};

export const updatePost = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await blogService.updatePost(
            req.user!.id,
            req.params.id as string,
            req.body as BlogPostUpdateInput,
        );

        sendBlogMutationResult(res, result);
    } catch (error: unknown) {
        console.error("updatePost error:", getErrorMessage(error));
        res.status(500).json({ success: false, message: "Failed to update post" });
    }
};

export const deletePost = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await blogService.deletePost(req.user!.id, req.params.id as string);

        if (result.status === "success") {
            res.status(200).json({ success: true, message: "Post deleted" });
            return;
        }

        sendBlogMutationResult(res, result);
    } catch (error: unknown) {
        console.error("deletePost error:", getErrorMessage(error));
        res.status(500).json({ success: false, message: "Failed to delete post" });
    }
};

export const publishDraft = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await blogService.publishDraft(req.user!.id, req.params.id as string);

        sendBlogMutationResult(res, result);
    } catch (error: unknown) {
        console.error("publishDraft error:", getErrorMessage(error));
        res.status(500).json({ success: false, message: "Failed to publish draft" });
    }
};
