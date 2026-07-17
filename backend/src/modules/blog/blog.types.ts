import type { Prisma } from "@prisma/client";

export type BlogListQuery = {
    page: number;
    limit: number;
};

export type BlogPostInput = {
    title: string;
    content: string;
    isDraft?: boolean;
};

export type BlogPostUpdateInput = Partial<BlogPostInput>;

export type BlogMutationResult<T> =
    | { status: "success"; data: T }
    | { status: "not_found" }
    | { status: "forbidden"; message: string }
    | { status: "bad_request"; message: string };

export const publishedPostSelect = {
    id: true,
    title: true,
    content: true,
    createdAt: true,
    updatedAt: true,
    author: {
        select: { id: true, name: true, avatarUrl: true },
    },
} satisfies Prisma.BlogPostSelect;

export const draftPostSelect = {
    id: true,
    title: true,
    content: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.BlogPostSelect;

export const createdPostSelect = {
    id: true,
    title: true,
    content: true,
    isDraft: true,
    createdAt: true,
    updatedAt: true,
    author: {
        select: { id: true, name: true },
    },
} satisfies Prisma.BlogPostSelect;

export const updatedPostSelect = {
    id: true,
    title: true,
    content: true,
    isDraft: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.BlogPostSelect;

export type PublishedPost = Prisma.BlogPostGetPayload<{ select: typeof publishedPostSelect }>;
export type DraftPost = Prisma.BlogPostGetPayload<{ select: typeof draftPostSelect }>;
export type CreatedPost = Prisma.BlogPostGetPayload<{ select: typeof createdPostSelect }>;
export type UpdatedPost = Prisma.BlogPostGetPayload<{ select: typeof updatedPostSelect }>;
