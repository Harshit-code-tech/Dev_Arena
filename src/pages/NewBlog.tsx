import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/newblog.css";
import { useEffect, useState } from "react";
import DraftModal from "../components/DraftModal";

const currentUser = {
    id: 123,
    name: "DevArena User",
};

function NewBlog() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const draftId = searchParams.get("draftId");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [showDraftModal, setShowDraftModal] = useState(false);

    const hasUnsavedContent = title.trim() !== "" || content.trim() !== "";

    useEffect(() => {
        if (!draftId) return;

        const drafts = JSON.parse(localStorage.getItem("devarena_blog_drafts") || "[]");
        const selectedDraft = drafts.find(
            (draft: { id: number }) => draft.id === Number(draftId)
        );

        if (!selectedDraft) return;

        setTitle(selectedDraft.title || "");
        setContent(selectedDraft.content || "");
    }, [draftId]);

    function saveDraft() {
        const draft = {
            id: Date.now(),
            title,
            authorId: currentUser.id,
            authorName: currentUser.name,
            content,
            savedAt: new Date().toISOString(),
        };

        const existingDrafts = JSON.parse(
            localStorage.getItem("devarena_blog_drafts") || "[]"
        );
        if (draftId) {
            const updatedDrafts = existingDrafts.map((draft: any) =>
                draft.id === Number(draftId) ? {
                    ...draft,
                    title,
                    content,
                    savedAt: new Date().toISOString(),
                }
                    : draft
            )
            localStorage.setItem(
                "devarena_blog_drafts",
                JSON.stringify(updatedDrafts)
            );
        } else {
            localStorage.setItem(
                "devarena_blog_drafts",
                JSON.stringify([draft, ...existingDrafts])
            );
        }
        navigate("/blog");
    }

    function publishPost() {
        if (title.trim() === "" || content.trim() === "") {
            return;
        }

        const post = {
            id: Date.now(),
            title,
            authorId: currentUser.id,
            authorName: currentUser.name,
            content,
            date: new Date().toISOString(),
        };

        const existingPosts = JSON.parse(
            localStorage.getItem("devarena_blog_posts") || "[]"
        );

        localStorage.setItem(
            "devarena_blog_posts",
            JSON.stringify([post, ...existingPosts])
        );

        if (draftId) {
            const drafts = JSON.parse(
                localStorage.getItem("devarena_blog_drafts") || "[]"
            );

            const remainingDrafts = drafts.filter(
                (draft: { id: number }) => draft.id !== Number(draftId)
            );

            localStorage.setItem("devarena_blog_drafts", JSON.stringify(remainingDrafts));
        }
        navigate("/blog");
    }

    return (
        <div className="blog-page">
            <div className="blog-wrap">
                <div className="blog-top">
                    <h1>Write a new post</h1>
                </div>
                <form className="blog-editor">
                    <input
                        type="text"
                        placeholder="Post title..."
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                    />

                    <textarea
                        placeholder="Share your thoughts, tutorial, or lesson learned..."
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                    />
                    <div className="editor-actions">
                        <button type="button" className="publish-btn" onClick={publishPost}>
                            Publish
                        </button>
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={() => {
                                if (hasUnsavedContent) {
                                    setShowDraftModal(true);
                                } else {
                                    navigate("/blog");
                                }
                            }}
                        >
                            Cancel
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
    )
}

export default NewBlog;
