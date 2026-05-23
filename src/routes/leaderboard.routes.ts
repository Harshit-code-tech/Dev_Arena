import { Router } from "express";
import * as leaderboardController from "../controllers/leaderboard.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// GET /api/leaderboard         -> Get current week's leaderboard
// GET /api/leaderboard/history  -> Get past week scores (future feature)
router.get("/", leaderboardController.getWeeklyLeaderboard);
router.get("/history", leaderboardController.getHistory);

export default router;
