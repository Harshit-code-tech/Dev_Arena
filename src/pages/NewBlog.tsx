import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/newblog.css";
import { useEffect, useState } from "react";
import DraftModal from "../components/DraftModal";

// The currentUser is now handled entirely by the backend via the auth token!
// For development, auth.middleware is temporarily hardcoded to use the test user ID.

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

        fetch("http://localhost:4000/api/blog/drafts")
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const selectedDraft = data.data.find((d: any) => d.id === draftId);
                    if (selectedDraft) {
                        setTitle(selectedDraft.title || "");
                        setContent(selectedDraft.content || "");
                    }
                }
            })
            .catch(console.error);
    }, [draftId]);

    async function saveDraft() {
        if (!title.trim() && !content.trim()) return navigate("/blog");

        const payload = { title, content, isDraft: true };
        try {
            if (draftId) {
                await fetch(`http://localhost:4000/api/blog/${draftId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                await fetch("http://localhost:4000/api/blog", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }
        } catch (error) {
            console.error(error);
        }
        navigate("/blog/drafts");
    }

    async function publishPost() {
        if (title.trim() === "" || content.trim() === "") {
            return;
        }

        const payload = { title, content, isDraft: false };
        try {
            if (draftId) {
                // Update first, then publish
                await fetch(`http://localhost:4000/api/blog/${draftId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                await fetch(`http://localhost:4000/api/blog/${draftId}/publish`, {
                    method: "PUT",
                });
            } else {
                await fetch("http://localhost:4000/api/blog", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }
        } catch (error) {
            console.error(error);
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
