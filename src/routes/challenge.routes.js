const express = require("express");
const router = express.Router();
const challengeController = require("../controllers/challenge.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

// GET  /api/challenge          → get current week's challenge results
// POST /api/challenge/submit   → submit challenge result
router.get("/", challengeController.getResults);
router.post("/submit", challengeController.submitResult);

module.exports = router;
