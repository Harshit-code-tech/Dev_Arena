const express = require("express");
const router = express.Router();
const fullstackController = require("../controllers/fullstack.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

// GET    /api/fullstack     → get all logs for current user
// POST   /api/fullstack     → create a new log
// PUT    /api/fullstack/:id → edit a log (within 24 hours)
// DELETE /api/fullstack/:id → delete a log (within 24 hours)
router.get("/", fullstackController.getLogs);
router.post("/", fullstackController.createLog);
router.put("/:id", fullstackController.updateLog);
router.delete("/:id", fullstackController.deleteLog);

module.exports = router;
