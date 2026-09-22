import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/Blog.css";
import {
    getPublishedBlogPosts,
    type BlogPostViewModel,
} from "../../../services/BlogService";

function Blog() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState<BlogPostViewModel[]>([]);

    useEffect(() => {
        getPublishedBlogPosts()
            .then(setPosts)
            .catch((err) => console.error("Failed to fetch blog posts:", err));
    }, []);

    return (
        <div className="blog-page">
            <div className="blog-wrap">
                <div className="blog-header">
                    <div>
                        <h1>DevArena Blog &amp; Dev Chronicles</h1>
                        <p style={{ color: "rgba(255,255,255,0.6)", marginTop: "4px" }}>Tech takes, bug post-mortems, and wisdom shipped from the trenches.</p>
                    </div>
                    <div className="blog-actions">
                        <button type="button" className="new-post-btn" onClick={() => navigate("/blog/new")}>
                            Write a post
                        </button>
                        <button type="button" className="drafts-btn" onClick={() => navigate("/blog/drafts")}>
                            Drafts
                        </button>
                    </div>
                </div>
                {posts.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "64px 16px", color: "rgba(255,255,255,0.5)" }}>
                        <h3 style={{ fontSize: "1.25rem", color: "#fff", marginBottom: "8px" }}>No articles published yet</h3>
                        <p>Got technical opinions, war stories, or lessons learned the hard way? Drop some knowledge!</p>
                    </div>
                ) : (
                    <div className="blog-feed">
                        {posts.map((post) => (
                            <div className="blog-post" key={post.id}>
                                <h3>{post.title}</h3>
                                <p>{post.content}</p>

                                <div className="blog-meta">
                                    <span className="blog-tag">{post.authorName}</span>
                                    {post.formattedDate}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Blog
