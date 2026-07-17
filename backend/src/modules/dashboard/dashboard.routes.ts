import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

// GET /api/dashboard/me
router.get("/me", protect, dashboardController.getDashboard);

// PUT /api/dashboard/me
router.put("/me", protect, dashboardController.updateDashboard);

export default router;
