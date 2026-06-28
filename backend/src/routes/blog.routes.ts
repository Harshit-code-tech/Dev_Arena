import { Router } from "express";
import * as blogController from "../controllers/blog.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Public
// GET /api/blog              -> List published posts
router.get("/", blogController.getPublishedPosts);

// Auth Required ( in future admin protected)
// GET /api/blog/drafts       -> List current user's drafts
// POST /api/blog              -> Create a post or draft
// PUT /api/blog/:id          -> Update a post (author only)
// DELETE /api/blog/:id        -> Delete a post (author only)
// PUT /api/blog/:id/publish  -> Publish a draft (author only)
router.get("/drafts", protect, blogController.getUserDrafts);
router.post("/", protect, blogController.createPost);
router.put("/:id", protect, blogController.updatePost);
router.delete("/:id", protect, blogController.deletePost);
router.put("/:id/publish", protect, blogController.publishDraft);

export default router;
