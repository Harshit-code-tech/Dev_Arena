import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/NewBlog.css";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DraftModal from "../components/DraftModal";
import {
    getBlogPostById,
    getDraftEditorViewModel,
    publishBlogPost,
    saveDraftPost,
    updatePublishedPost,
} from "../../../services/BlogService";

const SUGGESTED_TAGS = [
    "War Story",
    "Hot Take",
    "Tutorial",
    "Bug Rant",
    "Architecture",
    "Post-Mortem",
];

function NewBlog() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get("draftId");
    const postId = searchParams.get("postId");
    const isEditingPost = Boolean(postId);

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const hasUnsavedContent = title.trim() !== "" || content.trim() !== "";
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const charCount = content.length;

    useEffect(() => {
        if (postId) {
            getBlogPostById(postId)
                .then((post) => {
                    if (!post) return;
                    const tagMatch = post.title.match(/^\[(.*?)\]\s*(.*)$/);
                    if (tagMatch && SUGGESTED_TAGS.includes(tagMatch[1])) {
                        setSelectedTag(tagMatch[1]);
                        setTitle(tagMatch[2]);
                    } else {
                        setTitle(post.title);
                    }
                    setContent(post.content || "");
                })
                .catch(console.error);
            return;
        }

        if (draftId) {
            getDraftEditorViewModel(draftId)
                .then((draft) => {
                    if (!draft) return;
                    const tagMatch = draft.title.match(/^\[(.*?)\]\s*(.*)$/);
                    if (tagMatch && SUGGESTED_TAGS.includes(tagMatch[1])) {
                        setSelectedTag(tagMatch[1]);
                        setTitle(tagMatch[2]);
                    } else {
                        setTitle(draft.title || "");
                    }
                    setContent(draft.content || "");
                })
                .catch(console.error);
        }
    }, [draftId, postId]);

    const handleTagClick = (tag: string) => {
        if (selectedTag === tag) {
            setSelectedTag(null);
        } else {
            setSelectedTag(tag);
        }
    };

    async function saveDraft() {
        if (!title.trim() && !content.trim()) return navigate("/blog");

        setIsSaving(true);
        const finalTitle = selectedTag && !title.startsWith(`[${selectedTag}]`)
            ? `[${selectedTag}] ${title}`
            : title;
        const payload = { title: finalTitle, content, isDraft: true };
        try {
            if (postId) {
                await updatePublishedPost(postId, payload);
            } else {
                await saveDraftPost(draftId, payload);
            }
            toast.success("Draft saved successfully.");
            navigate("/blog/drafts");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save draft. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    async function publishPost() {
        if (title.trim() === "" || content.trim() === "") {
            return;
        }

        setIsPublishing(true);
        const finalTitle = selectedTag && !title.startsWith(`[${selectedTag}]`)
            ? `[${selectedTag}] ${title}`
            : title;
        const payload = { title: finalTitle, content, isDraft: false };
        try {
            if (postId) {
                await updatePublishedPost(postId, payload);
                toast.success("Post updated successfully!");
            } else {
                await publishBlogPost(draftId, payload);
                toast.success("Dispatch published to the arena!");
            }
            navigate("/blog");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save post. Please make sure you are logged in as the author.");
        } finally {
            setIsPublishing(false);
        }
    }

    return (
        <div className="blog-page new-blog-page">
            <div className="blog-wrap">
                <div className="editor-nav">
                    <button
                        type="button"
                        className="editor-back-btn"
                        onClick={() => {
                            if (hasUnsavedContent) {
                                setShowDraftModal(true);
                            } else {
                                navigate("/blog");
                            }
                        }}
                    >
                        <i className="bx bx-left-arrow-alt" aria-hidden="true" />
                        <span>Arena Dispatches</span>
                    </button>
                    {postId ? (
                        <span className="editor-draft-badge">Editing Published Post</span>
                    ) : draftId ? (
                        <span className="editor-draft-badge">Editing Draft</span>
                    ) : null}
                </div>

                <header className="blog-top">
                    <div>
                        <span className="blog-eyebrow">POST EDITOR</span>
                        <h1>{isEditingPost ? "Edit your post" : "Cook up a post"}</h1>
                        <p className="editor-lead">
                            {isEditingPost
                                ? "Refine your thoughts, fix typos, or update your technical breakdown."
                                : "Drop your wisdom, rant about a bug, or write a tutorial that future you will copy-paste."}
                        </p>
                    </div>
                </header>

                <form className="blog-editor" onSubmit={(e) => e.preventDefault()}>
                    <div className="editor-field-group">
                        <label htmlFor="post-title" className="editor-label">Post Title</label>
                        <input
                            id="post-title"
                            type="text"
                            placeholder="Something catchy (e.g. 'Why my code works on my machine')"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={160}
                        />
                    </div>

                    <div className="editor-tags-row">
                        <span className="tags-label">Category:</span>
                        <div className="tags-pills">
                            {SUGGESTED_TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    className={`tag-pill${selectedTag === tag ? " active" : ""}`}
                                    onClick={() => handleTagClick(tag)}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="editor-field-group">
                        <div className="editor-field-header">
                            <label htmlFor="post-content" className="editor-label">Content</label>
                            <span className="editor-counts">
                                {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount} chars
                            </span>
                        </div>
                        <textarea
                            id="post-content"
                            placeholder="Write your story, technical breakdown, or hot take here. Plain text and markdown friendly..."
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                        />
                    </div>

                    <div className="editor-actions">
                        <button
                            type="button"
                            className="draft-save-direct-btn"
                            onClick={saveDraft}
                            disabled={!hasUnsavedContent || isSaving}
                        >
                            <i className="bx bx-save" aria-hidden="true" />
                            {isSaving ? "Saving..." : "Save Draft"}
                        </button>

                        <button
                            type="button"
                            className="publish-btn"
                            onClick={publishPost}
                            disabled={!title.trim() || !content.trim() || isPublishing}
                        >
                            <i className={`bx ${isEditingPost ? "bx-check-circle" : "bx-paper-plane"}`} aria-hidden="true" />
                            {isPublishing
                                ? (isEditingPost ? "Saving..." : "Shipping...")
                                : (isEditingPost ? "Save Changes" : "Ship to the World")}
                        </button>
                    </div>
                </form>

                {showDraftModal && (
                    <DraftModal
                        onSave={saveDraft}
                        onDiscard={() => navigate("/blog")}
                        onKeepEditing={() => setShowDraftModal(false)}
                    />
                )}
            </div>
        </div>
    );
}

export default NewBlog;

