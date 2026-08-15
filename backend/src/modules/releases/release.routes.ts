import { Router } from "express";
import * as releaseController from "./release.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

// Public
// GET  /api/releases          -> List all releases
router.get("/", releaseController.getReleases);

// Automation Webhook (Protected by secret)
router.post("/automate", releaseController.automateRelease);

// Auth Required (admin protected in future)
// POST /api/releases        -> Create a release entry
// PUT  /api/releases/:id    -> Update a release entry
// DELETE /api/releases/:id    -> Delete a release entry
router.post("/", protect, releaseController.createRelease);
router.put("/:id", protect, releaseController.updateRelease);
router.delete("/:id", protect, releaseController.deleteRelease);

export default router;
