import {
  BLOG_DATE_FORMAT_OPTIONS,
  BLOG_FALLBACK_AUTHOR_NAME,
  BLOG_POSTS_LIMIT,
} from "./BlogConstants";
import { apiRequest } from "./ApiClient";

type BlogPostPayload = {
  content: string;
  isDraft: boolean;
  title: string;
};

type BackendBlogAuthor = {
  id?: string;
  name?: string | null;
};

type BackendBlogPost = {
  id: string;
  title: string;
  content: string;
  author?: BackendBlogAuthor | null;
  createdAt: string;
};

type BackendDraftPost = {
  id: string;
  title: string;
  content: string;
  author?: BackendBlogAuthor | null;
  authorId?: string;
  updatedAt: string;
};

type BackendListResponse<T> = {
  success: boolean;
  data?: T[];
};

export type BlogPostViewModel = {
  authorId?: string;
  authorName: string;
  content: string;
  formattedDate: string;
  id: string;
  title: string;
};

export type DraftPostViewModel = {
  authorId?: string;
  authorName: string;
  content: string;
  formattedSavedAt: string;
  id: string;
  savedAt: string;
  title: string;
};

export type DraftEditorViewModel = {
  content: string;
  title: string;
};

// Public — no auth needed
export async function getPublishedBlogPosts(): Promise<BlogPostViewModel[]> {
  const response = await fetch(`/api/blog?limit=${BLOG_POSTS_LIMIT}`);
  const data: BackendListResponse<BackendBlogPost> = await response.json();
  return buildPublishedBlogPostsViewModel(data);
}

// Authenticated operations — all use apiRequest which attaches the JWT
export async function getDraftPosts(): Promise<DraftPostViewModel[]> {
  const data = await apiRequest<BackendDraftPost[]>("/api/blog/drafts");
  return mapDraftPosts(data);
}

export async function getDraftEditorViewModel(draftId: string): Promise<DraftEditorViewModel | null> {
  const drafts = await getDraftPosts();
  const selectedDraft = findDraftById(drafts, draftId);

  if (!selectedDraft) {
    return null;
  }

  return {
    content: selectedDraft.content,
    title: selectedDraft.title,
  };
}

export async function getBlogPostById(id: string): Promise<BlogPostViewModel | null> {
  try {
    const response = await fetch(`/api/blog/${id}`);
    const result = await response.json();
    if (!result.success || !result.data) {
      return null;
    }
    return mapPublishedPost(result.data);
  } catch (err) {
    console.error("Failed to fetch blog post by id:", err);
    return null;
  }
}

export async function updatePublishedPost(id: string, payload: BlogPostPayload): Promise<void> {
  await updateBlogPost(id, payload);
}

export async function deleteBlogPost(id: string): Promise<void> {
  await apiRequest<void>(`/api/blog/${id}`, { method: "DELETE" });
}

export async function saveDraftPost(draftId: string | null, payload: BlogPostPayload): Promise<void> {
  if (draftId) {
    await updateBlogPost(draftId, payload);
    return;
  }
  await createBlogPost(payload);
}

export async function publishBlogPost(draftId: string | null, payload: BlogPostPayload): Promise<void> {
  if (draftId) {
    await updateBlogPost(draftId, payload);
    await publishDraft(draftId);
    return;
  }
  await createBlogPost(payload);
}

function buildPublishedBlogPostsViewModel(
  response: BackendListResponse<BackendBlogPost>,
): BlogPostViewModel[] {
  if (!response.success) {
    return [];
  }
  return mapPublishedPosts(response.data || []);
}

function mapPublishedPosts(posts: BackendBlogPost[]) {
  return posts.map(mapPublishedPost);
}

function mapPublishedPost(post: BackendBlogPost): BlogPostViewModel {
  return {
    authorId: post.author?.id,
    authorName: getAuthorName(post.author),
    content: post.content,
    formattedDate: formatBlogDate(post.createdAt),
    id: post.id,
    title: post.title,
  };
}

function mapDraftPosts(drafts: BackendDraftPost[]) {
  return drafts.map(mapDraftPost);
}

function mapDraftPost(draft: BackendDraftPost): DraftPostViewModel {
  return {
    authorId: draft.authorId,
    authorName: getAuthorName(draft.author),
    content: draft.content,
    formattedSavedAt: formatBlogDate(draft.updatedAt),
    id: draft.id,
    savedAt: draft.updatedAt,
    title: draft.title,
  };
}

function findDraftById(drafts: DraftPostViewModel[], draftId: string) {
  return drafts.find((draft) => draft.id === draftId);
}

function getAuthorName(author: BackendBlogAuthor | null | undefined) {
  return author?.name || BLOG_FALLBACK_AUTHOR_NAME;
}

function formatBlogDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", BLOG_DATE_FORMAT_OPTIONS);
}

async function createBlogPost(payload: BlogPostPayload): Promise<void> {
  await apiRequest<void>("/api/blog", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function updateBlogPost(id: string, payload: BlogPostPayload): Promise<void> {
  await apiRequest<void>(`/api/blog/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function publishDraft(id: string): Promise<void> {
  await apiRequest<void>(`/api/blog/${id}/publish`, { method: "PUT" });
}
