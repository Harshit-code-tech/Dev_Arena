import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as leaderboardController from "./leaderboard.controller";

const router = Router();

router.use(protect);
router.get("/", leaderboardController.getLeaderboard);
router.get("/nearby", leaderboardController.getNearby);
router.get("/search", leaderboardController.searchLeaderboard);

export default router;
