import { blogRepository } from "./blog.repository";
import type {
    BlogListQuery,
    BlogMutationResult,
    BlogPostInput,
    BlogPostUpdateInput,
    CreatedPost,
    DraftPost,
    PublishedPost,
    UpdatedPost,
} from "./blog.types";

type BlogListResult = {
    posts: PublishedPost[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};

type BlogService = {
    getPublishedPosts(query: BlogListQuery): Promise<BlogListResult>;
    getUserDrafts(userId: string): Promise<DraftPost[]>;
    createPost(userId: string, input: BlogPostInput): Promise<CreatedPost>;
    updatePost(userId: string, id: string, input: BlogPostUpdateInput): Promise<BlogMutationResult<UpdatedPost>>;
    deletePost(userId: string, id: string): Promise<BlogMutationResult<null>>;
    publishDraft(userId: string, id: string): Promise<BlogMutationResult<CreatedPost>>;
};

export const blogService: BlogService = {
    async getPublishedPosts({ page, limit }: BlogListQuery): Promise<BlogListResult> {
        const skip = (page - 1) * limit;
        const [posts, total] = await blogRepository.listPublishedPosts(skip, limit);

        return {
            posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    getUserDrafts(userId: string): Promise<DraftPost[]> {
        return blogRepository.listDraftsByUser(userId);
    },

    createPost(userId: string, input: BlogPostInput): Promise<CreatedPost> {
        return blogRepository.createPost(userId, input);
    },

    async updatePost(userId: string, id: string, input: BlogPostUpdateInput): Promise<BlogMutationResult<UpdatedPost>> {
        const existing = await blogRepository.findPostById(id);

        if (!existing) {
            return { status: "not_found" };
        }

        if (existing.authorId !== userId) {
            return { status: "forbidden", message: "You can only edit your own posts" };
        }

        return { status: "success", data: await blogRepository.updatePost(id, input) };
    },

    async deletePost(userId: string, id: string): Promise<BlogMutationResult<null>> {
        const existing = await blogRepository.findPostById(id);

        if (!existing) {
            return { status: "not_found" };
        }

        if (existing.authorId !== userId) {
            return { status: "forbidden", message: "You can only delete your own posts" };
        }

        await blogRepository.deletePost(id);
        return { status: "success", data: null };
    },

    async publishDraft(userId: string, id: string): Promise<BlogMutationResult<CreatedPost>> {
        const existing = await blogRepository.findPostById(id);

        if (!existing) {
            return { status: "not_found" };
        }

        if (existing.authorId !== userId) {
            return { status: "forbidden", message: "You can only publish your own drafts" };
        }

        if (!existing.isDraft) {
            return { status: "bad_request", message: "This post is already published" };
        }

        return { status: "success", data: await blogRepository.publishPost(id) };
    },
};
