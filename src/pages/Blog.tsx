import { useEffect, useState } from "react";
import "../styles/blog.css";
import { useNavigate } from "react-router-dom";

type BlogPost = {
    id: number;
    title: string;
    content: string;
    authorName: string;
    date: string;
}
const postsStorageKey = "devarena_blog_posts";

const initialPosts: BlogPost[] = [
    {
        id: 1,
        title: "Why I switched from Redux to Zustand",
        authorName: "Priya Sharma",
        content:
            "After 3 years of Redux boilerplate, I finally made the move to Zustand. The mental overhead reduction alone was worth it.",
        date: "12 Apr 2025",
    },
    {
        id: 2,
        title: "Building a real-time dashboard with WebSockets",
        authorName: "Marcus Chen",
        content:
            "A step-by-step breakdown of how I built a live analytics dashboard using Node.js and WebSockets.",
        date: "10 Apr 2025",
    },
];

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
        const savedPosts = JSON.parse(
            localStorage.getItem(postsStorageKey) || "[]"
        ) as BlogPost[];

        setPosts([...savedPosts, ...initialPosts]);
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
