import { Router } from "express";
import * as challengeController from "./challenge.controller";
import { protect } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";

const router = Router();

// All challenge endpoints require authentication
router.use(protect);

// ── Player-facing ────────────────────────────────────────────────
router.get("/", challengeController.getActiveCompetition);
router.post("/submit", challengeController.submitCode);
router.get("/results", challengeController.getResults);

// ── Admin ────────────────────────────────────────────────────────
router.post("/admin/competition", requireAdmin, challengeController.createCompetition);
router.post("/admin/competition/:id/activate", requireAdmin, challengeController.activateCompetition);
router.post("/admin/competition/:id/aggregate", requireAdmin, challengeController.aggregateResults);
router.post("/admin/task", requireAdmin, challengeController.createTask);
router.post("/admin/test-case", requireAdmin, challengeController.createTestCase);

export default router;
