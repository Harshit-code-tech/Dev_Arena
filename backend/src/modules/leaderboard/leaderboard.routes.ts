import { Router } from "express";
import * as leaderboardController from "./leaderboard.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", leaderboardController.getWeeklyLeaderboard);
router.get("/history", leaderboardController.getHistory);

export default router;
