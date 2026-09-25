import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import * as aiController from "./ai.controller";

const router = Router();

// All AI endpoints require authentication
router.use(protect);

// POST /api/ai/rival-roast
// Authenticated player triggers a roast of themselves vs a rival.
// Also called internally by scoring.service when rank drops.
router.post("/rival-roast", aiController.rivalRoast);

// POST /api/ai/generate-challenge   (admin only)
// Admin-facing: generate a challenge task from a topic using Gemini Flash.
router.post("/generate-challenge", requireAdmin, aiController.generateChallenge);

export default router;
