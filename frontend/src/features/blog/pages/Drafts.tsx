import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/Drafts.css";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import {
    deleteBlogPost,
    getDraftPosts,
    type DraftPostViewModel,
} from "../../../services/BlogService";

function Drafts() {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState<DraftPostViewModel[]>([]);
    const [draftToDelete, setDraftToDelete] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        getDraftPosts()
            .then(setDrafts)
            .catch(console.error);
    }, []);

    async function confirmDeleteDraft() {
        if (!draftToDelete) return;
        setIsDeleting(true);
        try {
            await deleteBlogPost(draftToDelete.id);
            setDrafts((prev) => prev.filter((draft) => draft.id !== draftToDelete.id));
            toast.success("Draft deleted.");
            setDraftToDelete(null);
        } catch (error) {
            console.error("Failed to delete draft:", error);
            toast.error("Failed to delete draft.");
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="drafts-page">
            <div className="drafts-wrap">
                <div className="drafts-header">
                    <div>
                        <h1>Graveyard of Half-Finished Thoughts</h1>
                        <p>Where brilliant 2 AM epiphanies come to gather dust.</p>
                    </div>

                    <button
                        type="button"
                        className="drafts-back-btn dev-back-button"
                        onClick={() => navigate("/blog")}
                    >
                        <span aria-hidden="true">←</span><span>Back</span>
                    </button>
                </div>

                {drafts.length === 0 ? (
                    <div className="drafts-empty">
                        <h2>Zero unfinished drafts</h2>
                        <p>You either finish everything you start, or you haven't started anything at all. We suspect the latter.</p>
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
                                        onClick={() => setDraftToDelete({ id: draft.id, title: draft.title })}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={Boolean(draftToDelete)}
                title="Discard Draft?"
                message={`Are you sure you want to delete "${draftToDelete?.title || "this draft"}"? This action cannot be undone.`}
                confirmLabel="Delete Draft"
                cancelLabel="Keep Draft"
                isDestructive={true}
                isLoading={isDeleting}
                onConfirm={confirmDeleteDraft}
                onCancel={() => {
                    if (!isDeleting) setDraftToDelete(null);
                }}
            />
        </div>
    );
}

export default Drafts;
