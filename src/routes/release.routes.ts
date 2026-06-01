import { Router } from "express";
import * as releaseController from "../controllers/release.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// Public
// GET  /api/releases          -> List all releases
router.get("/", releaseController.getReleases);

// Auth Required (admin protected in future)
// POST /api/releases        -> Create a release entry
// PUT  /api/releases/:id    -> Update a release entry
// DELETE /api/releases/:id    -> Delete a release entry
// POST /api/releases/automate -> Create a release entry
router.post("/", protect, releaseController.createRelease);
router.put("/:id", protect, releaseController.updateRelease);
router.delete("/:id", protect, releaseController.deleteRelease);
router.post("/automate", releaseController.automateRelease);
export default router;
