import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/NewBlog.css";
import { useEffect, useState } from "react";
import DraftModal from "../components/DraftModal";
import {
    getDraftEditorViewModel,
    publishBlogPost,
    saveDraftPost,
} from "../../../services/BlogService";

// The current user will be handled by the backend once auth is implemented.
// For development, auth.middleware is temporarily hardcoded to use a test user.

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

        getDraftEditorViewModel(draftId)
            .then((draft) => {
                if (!draft) return;

                setTitle(draft.title || "");
                setContent(draft.content || "");
            })
            .catch(console.error);
    }, [draftId]);

    async function saveDraft() {
        if (!title.trim() && !content.trim()) return navigate("/blog");

        const payload = { title, content, isDraft: true };
        try {
            await saveDraftPost(draftId, payload);
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
            await publishBlogPost(draftId, payload);
        } catch (error) {
            console.error(error);
        }
        navigate("/blog");
    }

    return (
        <div className="blog-page">
            <div className="blog-wrap">
                <div className="blog-top">
                    <h1>Cook up a post</h1>
                </div>
                <form className="blog-editor">
                    <input
                        type="text"
                        placeholder="Something catchy (e.g. 'Why my code works on my machine')"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                    />

                    <textarea
                        placeholder="Drop your wisdom, rant about a bug, or write a tutorial that future you will copy-paste..."
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                    />
                    <div className="editor-actions">
                        <button type="button" className="publish-btn" onClick={publishPost}>
                            Ship to the World 🚀
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
