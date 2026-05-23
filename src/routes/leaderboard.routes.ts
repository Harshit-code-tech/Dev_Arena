import { Router } from "express";
import * as leaderboardController from "../controllers/leaderboard.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// GET /api/leaderboard          → current week's leaderboard
// GET /api/leaderboard/history  → past week scores (future feature)
router.get("/", leaderboardController.getWeeklyLeaderboard);
router.get("/history", leaderboardController.getHistory);

export default router;
