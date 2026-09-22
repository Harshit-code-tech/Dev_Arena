import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/Blog.css";
import {
    deleteBlogPost,
    getPublishedBlogPosts,
    type BlogPostViewModel,
} from "../../../services/BlogService";
import {
    getReleasePageViewModel,
    type UpdateEntry,
} from "../../../services/ReleaseService";
import UpdatesTimeline from "../../releases/components/UpdatesTimeline";
import { useAuth } from "../../auth/context/AuthContext";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";

type Tab = "posts" | "changelog";

function Blog() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("posts");
    const [posts, setPosts] = useState<BlogPostViewModel[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [releases, setReleases] = useState<UpdateEntry[]>([]);
    const [releasesLoading, setReleasesLoading] = useState(false);
    const [releasesLoaded, setReleasesLoaded] = useState(false);
    const [postToDelete, setPostToDelete] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        getPublishedBlogPosts()
            .then(setPosts)
            .catch((err) => console.error("Failed to fetch blog posts:", err))
            .finally(() => setPostsLoading(false));
    }, []);

    const confirmDeletePost = async () => {
        if (!postToDelete) return;

        setIsDeleting(true);
        try {
            await deleteBlogPost(postToDelete.id);
            setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
            toast.success("Dispatch deleted successfully.");
            setPostToDelete(null);
        } catch (err) {
            console.error("Failed to delete post:", err);
            toast.error("Failed to delete post. Please verify your permissions.");
        } finally {
            setIsDeleting(false);
        }
    };

    const loadReleases = useCallback(() => {
        if (releasesLoaded || releasesLoading) return;
        setReleasesLoading(true);
        getReleasePageViewModel(1)
            .then((vm) => {
                setReleases(vm.entries.slice(0, 5));
                setReleasesLoaded(true);
            })
            .catch((err) => console.error("Failed to fetch releases:", err))
            .finally(() => setReleasesLoading(false));
    }, [releasesLoaded, releasesLoading]);

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === "changelog") loadReleases();
    };

    return (
        <div className="blog-page">
            <div className="blog-wrap">

                {/* ── Header ── */}
                <header className="blog-header">
                    <div className="blog-header-copy">
                        <span className="blog-eyebrow">DevArena</span>
                        <h1>Dispatches from<br />the arena</h1>
                        <p className="blog-subtitle">
                            Dev war stories, platform changelogs, and opinions that'll probably start a flame war.
                        </p>
                    </div>
                    <div className="blog-header-actions">
                        <button type="button" className="new-post-btn" onClick={() => navigate("/blog/new")}>
                            <i className="bx bx-edit-alt" aria-hidden="true" />
                            Write a post
                        </button>
                        <button type="button" className="drafts-btn" onClick={() => navigate("/blog/drafts")}>
                            <i className="bx bx-file-blank" aria-hidden="true" />
                            Drafts
                        </button>
                    </div>
                </header>

                {/* ── Tab switcher ── */}
                <div className="blog-tabs" role="tablist" aria-label="Blog sections">
                    <button
                        type="button"
                        role="tab"
                        id="tab-posts"
                        aria-controls="panel-posts"
                        aria-selected={activeTab === "posts"}
                        className={`blog-tab${activeTab === "posts" ? " active" : ""}`}
                        onClick={() => handleTabChange("posts")}
                    >
                        <i className="bx bx-news" aria-hidden="true" />
                        Community posts
                    </button>
                    <button
                        type="button"
                        role="tab"
                        id="tab-changelog"
                        aria-controls="panel-changelog"
                        aria-selected={activeTab === "changelog"}
                        className={`blog-tab${activeTab === "changelog" ? " active" : ""}`}
                        onClick={() => handleTabChange("changelog")}
                    >
                        <i className="bx bx-git-merge" aria-hidden="true" />
                        Platform updates
                    </button>
                </div>

                {/* ── Posts panel ── */}
                <div
                    id="panel-posts"
                    role="tabpanel"
                    aria-labelledby="tab-posts"
                    hidden={activeTab !== "posts"}
                    className="blog-panel"
                >
                    {postsLoading ? (
                        <div className="blog-skeleton">
                            {Array.from({ length: 3 }, (_, i) => <span key={i} className="blog-skeleton-card" />)}
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="blog-empty">
                            <i className="bx bx-message-square-dots blog-empty-icon" aria-hidden="true" />
                            <h3>No posts yet — be the first to talk trash</h3>
                            <p>Got hot takes, post-mortems, or dark patterns you want to warn people about? The floor's yours.</p>
                            <button type="button" className="new-post-btn" onClick={() => navigate("/blog/new")}>
                                Drop some knowledge
                            </button>
                        </div>
                    ) : (
                        <div className="blog-feed">
                            {posts.map((post) => {
                                const isAuthorOrAdmin = Boolean(
                                    user && post.authorId && (user.uid === post.authorId || ("isAdmin" in user && user.isAdmin))
                                );

                                return (
                                    <article className="blog-post" key={post.id}>
                                        <div className="blog-post-header">
                                            <h3>{post.title}</h3>
                                            {isAuthorOrAdmin && (
                                                <div className="post-owner-actions">
                                                    <button
                                                        type="button"
                                                        className="post-edit-btn"
                                                        onClick={() => navigate(`/blog/new?postId=${post.id}`)}
                                                        title="Edit post"
                                                    >
                                                        <i className="bx bx-edit-alt" aria-hidden="true" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="post-delete-btn"
                                                        onClick={() => setPostToDelete({ id: post.id, title: post.title })}
                                                        title="Delete post"
                                                        disabled={isDeleting && postToDelete?.id === post.id}
                                                    >
                                                        <i className="bx bx-trash" aria-hidden="true" />
                                                        <span>{isDeleting && postToDelete?.id === post.id ? "Deleting..." : "Delete"}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <p>{post.content}</p>
                                        <div className="blog-meta">
                                            <span className="blog-tag">{post.authorName}</span>
                                            <span className="blog-date">{post.formattedDate}</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Changelog panel ── */}
                <div
                    id="panel-changelog"
                    role="tabpanel"
                    aria-labelledby="tab-changelog"
                    hidden={activeTab !== "changelog"}
                    className="blog-panel"
                >
                    {releasesLoading ? (
                        <div className="blog-skeleton">
                            {Array.from({ length: 3 }, (_, i) => <span key={i} className="blog-skeleton-card" />)}
                        </div>
                    ) : releases.length === 0 && releasesLoaded ? (
                        <div className="blog-empty">
                            <i className="bx bx-git-commit blog-empty-icon" aria-hidden="true" />
                            <h3>No releases shipped yet</h3>
                            <p>We're either furiously coding or suspiciously quiet. Either way, check back soon.</p>
                        </div>
                    ) : releases.length > 0 ? (
                        <>
                            <UpdatesTimeline entries={releases} isFirstPage={true} />
                            <div className="blog-changelog-footer">
                                <button
                                    type="button"
                                    className="changelog-all-link"
                                    onClick={() => navigate("/updates")}
                                >
                                    View full changelog
                                    <i className="bx bx-right-arrow-alt" aria-hidden="true" />
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>

            </div>

            <ConfirmDialog
                isOpen={Boolean(postToDelete)}
                title="Delete Dispatch?"
                message={`Are you sure you want to delete "${postToDelete?.title || "this post"}"? This action is permanent and cannot be undone.`}
                confirmLabel="Delete Post"
                cancelLabel="Keep Post"
                isDestructive={true}
                isLoading={isDeleting}
                onConfirm={confirmDeletePost}
                onCancel={() => {
                    if (!isDeleting) setPostToDelete(null);
                }}
            />
        </div>
    );
}

export default Blog;
