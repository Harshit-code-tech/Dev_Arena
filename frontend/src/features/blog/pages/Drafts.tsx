import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/Drafts.css";
import {
    deleteBlogPost,
    getDraftPosts,
    type DraftPostViewModel,
} from "../../../services/BlogService";

function Drafts() {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState<DraftPostViewModel[]>([]);

    useEffect(() => {
        getDraftPosts()
            .then(setDrafts)
            .catch(console.error);
    }, []);

    async function deleteDraft(id: string) {
        try {
            await deleteBlogPost(id);
            setDrafts((prev) => prev.filter((draft) => draft.id !== id));
        } catch (error) {
            console.error("Failed to delete draft:", error);
        }
    }

    return (
        <div className="drafts-page">
            <div className="drafts-wrap">
                <div className="drafts-header">
                    <div>
                        <h1>Draft collection</h1>
                        <p>Saved blog ideas you can come back to later.</p>
                    </div>

                    <button
                        type="button"
                        className="drafts-back-btn"
                        onClick={() => navigate("/blog")}
                    >
                        Back to blog
                    </button>
                </div>

                {drafts.length === 0 ? (
                    <div className="drafts-empty">
                        <h2>No drafts yet</h2>
                        <p>Your unsaved posts will show up here.</p>
                    </div>
                ) : (
                    <div className="drafts-list">
                        {drafts.map((draft) => (
                            <article className="draft-card" key={draft.id}>
                                <div className="draft-card-top">
                                    <h2>{draft.title || "Untitled draft"}</h2>
                                    <span>{draft.formattedSavedAt}</span>
                                </div>

                                <p>{draft.content || "No content added yet."}</p>

                                <div className="draft-card-footer">
                                    <span>{draft.authorName || "Anonymous"}</span>
                                    <button
                                        type="button"
                                        className="draft-edit-btn"
                                        onClick={() => navigate(`/blog/new?draftId=${draft.id}`)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="draft-delete-btn"
                                        onClick={() => deleteDraft(draft.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Drafts;
