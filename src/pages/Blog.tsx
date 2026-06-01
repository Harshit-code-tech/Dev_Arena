import { useEffect, useState } from "react";
import "../styles/blog.css";
import { useNavigate } from "react-router-dom";

type BlogPost = {
    id: string;
    title: string;
    content: string;
    authorName: string;
    date: string;
}


function formatPostDate(date: string) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function Blog() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<BlogPost[]>([]);

    useEffect(() => {
        fetch("/api/blog?limit=50")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    const mappedPosts = data.data.map((post: any) => ({
                        id: post.id,
                        title: post.title,
                        content: post.content,
                        authorName: post.author?.name || "DevArena User",
                        date: post.createdAt,
                    }));
                    setPosts(mappedPosts);
                }
            })
            .catch((err) => console.error("Failed to fetch blog posts:", err));
    }, []);

    return (
        <div className="blog-page">
            <div className="blog-wrap">
                <div className="blog-header">
                    <h1>DevArena Blog</h1>
                    <div className="blog-actions">
                        <button type="button" className="new-post-btn" onClick={() => navigate("/blog/new")}>
                            Write a post
                        </button>
                        <button type="button" className="drafts-btn" onClick={() => navigate("/blog/drafts")}>
                            Drafts
                        </button>
                    </div>
                </div>
                <div className="blog-feed">
                    {posts.map((post) => (
                        <div className="blog-post" key={post.id}>
                            <h3>{post.title}</h3>
                            <p>{post.content}</p>

                            <div className="blog-meta">
                                <span className="blog-tag">{post.authorName || "DevArena User"}</span>
                                {formatPostDate(post.date)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Blog
