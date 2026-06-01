import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/drafts.css";

type DraftPost = {
    id: string;
    title: string;
    author?: string;
    authorId?: string;
    authorName?: string;
    content: string;
    savedAt: string;
};

function formatSavedDate(savedAt: string) {
    return new Date(savedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function Drafts() {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState<DraftPost[]>([]);

    useEffect(() => {
        fetch("/api/blog/drafts")
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const mappedDrafts = data.data.map((draft: any) => ({
                        id: draft.id,
                        title: draft.title,
                        content: draft.content,
                        savedAt: draft.updatedAt,
                        authorName: draft.author?.name || "DevArena User",
                    }));
                    setDrafts(mappedDrafts);
                }
            })
            .catch(console.error);
    }, []);

    async function deleteDraft(id: string) {
        try {
            const res = await fetch(`/api/blog/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete draft");
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
                                    <span>{formatSavedDate(draft.savedAt)}</span>
                                </div>

                                <p>{draft.content || "No content added yet."}</p>

                                <div className="draft-card-footer">
                                    <span>{draft.authorName || draft.author || "Anonymous"}</span>
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
