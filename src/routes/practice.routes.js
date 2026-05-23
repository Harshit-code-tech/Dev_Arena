const express = require("express");
const router = express.Router();
const practiceController = require("../controllers/practice.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

// GET    /api/practice     → get all practice logs for current user
// POST   /api/practice     → add a revision / concept explanation entry
// PUT    /api/practice/:id → edit (within 24 hours)
// DELETE /api/practice/:id → delete (within 24 hours)
router.get("/", practiceController.getLogs);
router.post("/", practiceController.createLog);
router.put("/:id", practiceController.updateLog);
router.delete("/:id", practiceController.deleteLog);

module.exports = router;
