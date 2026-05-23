const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboard.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

// GET /api/leaderboard          → current week's leaderboard
// GET /api/leaderboard/history  → past week scores (future feature)
router.get("/", leaderboardController.getWeeklyLeaderboard);
router.get("/history", leaderboardController.getHistory);

module.exports = router;
