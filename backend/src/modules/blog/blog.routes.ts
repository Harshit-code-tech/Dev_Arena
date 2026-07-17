import { Router } from "express";
import * as blogController from "./blog.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.get("/", blogController.getPublishedPosts);

router.get("/drafts", protect, blogController.getUserDrafts);
router.post("/", protect, blogController.createPost);
router.put("/:id", protect, blogController.updatePost);
router.delete("/:id", protect, blogController.deletePost);
router.put("/:id/publish", protect, blogController.publishDraft);

export default router;
