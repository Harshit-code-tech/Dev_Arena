import type { BlogPost } from "@prisma/client";
import { prisma } from "../../database/prisma";
import {
    createdPostSelect,
    draftPostSelect,
    publishedPostSelect,
    updatedPostSelect,
    type BlogPostInput,
    type BlogPostUpdateInput,
    type CreatedPost,
    type DraftPost,
    type PublishedPost,
    type UpdatedPost,
} from "./blog.types";

type BlogRepository = {
    listPublishedPosts(skip: number, limit: number): Promise<[PublishedPost[], number]>;
    listDraftsByUser(userId: string): Promise<DraftPost[]>;
    createPost(userId: string, input: BlogPostInput): Promise<CreatedPost>;
    findPostById(id: string): Promise<BlogPost | null>;
    updatePost(id: string, input: BlogPostUpdateInput): Promise<UpdatedPost>;
    deletePost(id: string): Promise<void>;
    publishPost(id: string): Promise<CreatedPost>;
};

export const blogRepository: BlogRepository = {
    listPublishedPosts(skip: number, limit: number): Promise<[PublishedPost[], number]> {
        return Promise.all([
            prisma.blogPost.findMany({
                where: { isDraft: false },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: publishedPostSelect,
            }),
            prisma.blogPost.count({ where: { isDraft: false } }),
        ]);
    },

    listDraftsByUser(userId: string): Promise<DraftPost[]> {
        return prisma.blogPost.findMany({
            where: { authorId: userId, isDraft: true },
            orderBy: { updatedAt: "desc" },
            select: draftPostSelect,
        });
    },

    createPost(userId: string, input: BlogPostInput): Promise<CreatedPost> {
        return prisma.blogPost.create({
            data: {
                authorId: userId,
                title: input.title,
                content: input.content,
                isDraft: input.isDraft === true,
            },
            select: createdPostSelect,
        });
    },

    findPostById(id: string): Promise<BlogPost | null> {
        return prisma.blogPost.findUnique({ where: { id } });
    },

    updatePost(id: string, input: BlogPostUpdateInput): Promise<UpdatedPost> {
        return prisma.blogPost.update({
            where: { id },
            data: {
                ...(input.title !== undefined && { title: input.title }),
                ...(input.content !== undefined && { content: input.content }),
                ...(input.isDraft !== undefined && { isDraft: input.isDraft }),
            },
            select: updatedPostSelect,
        });
    },

    async deletePost(id: string): Promise<void> {
        await prisma.blogPost.delete({ where: { id } });
    },

    publishPost(id: string): Promise<CreatedPost> {
        return prisma.blogPost.update({
            where: { id },
            data: { isDraft: false },
            select: createdPostSelect,
        });
    },
};
