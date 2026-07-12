import {
  BLOG_DATE_FORMAT_OPTIONS,
  BLOG_FALLBACK_AUTHOR_NAME,
  BLOG_POSTS_LIMIT,
} from "./BlogConstants";

type BlogPostPayload = {
  content: string;
  isDraft: boolean;
  title: string;
};

type BackendBlogAuthor = {
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

export async function getPublishedBlogPosts(): Promise<BlogPostViewModel[]> {
  const response = await fetch(`/api/blog?limit=${BLOG_POSTS_LIMIT}`);
  const data: BackendListResponse<BackendBlogPost> = await response.json();

  return buildPublishedBlogPostsViewModel(data);
}

export async function getDraftPosts(): Promise<DraftPostViewModel[]> {
  const response = await fetch("/api/blog/drafts");
  const data: BackendListResponse<BackendDraftPost> = await response.json();

  return buildDraftPostsViewModel(data);
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

export async function deleteBlogPost(id: string) {
  const response = await fetch(`/api/blog/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete draft");
  }
}

export async function saveDraftPost(draftId: string | null, payload: BlogPostPayload) {
  if (draftId) {
    await updateBlogPost(draftId, payload);
    return;
  }

  await createBlogPost(payload);
}

export async function publishBlogPost(draftId: string | null, payload: BlogPostPayload) {
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

function buildDraftPostsViewModel(
  response: BackendListResponse<BackendDraftPost>,
): DraftPostViewModel[] {
  if (!response.success) {
    return [];
  }

  return mapDraftPosts(response.data || []);
}

function mapPublishedPosts(posts: BackendBlogPost[]) {
  return posts.map(mapPublishedPost);
}

function mapPublishedPost(post: BackendBlogPost): BlogPostViewModel {
  return {
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

async function createBlogPost(payload: BlogPostPayload) {
  await fetch("/api/blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function updateBlogPost(id: string, payload: BlogPostPayload) {
  await fetch(`/api/blog/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function publishDraft(id: string) {
  await fetch(`/api/blog/${id}/publish`, {
    method: "PUT",
  });
}
