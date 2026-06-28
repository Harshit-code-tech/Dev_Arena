import { Router } from "express";
import * as practiceController from "../controllers/practice.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// GET    /api/practice     -> Get all practice logs for current user
// POST   /api/practice     -> Add a revision / concept explanation entry
// PUT    /api/practice/:id -> Edit (within 24 hours)
// DELETE /api/practice/:id -> Delete (within 24 hours)
router.get("/", practiceController.getLogs);
router.post("/", practiceController.createLog);
router.put("/:id", practiceController.updateLog);
router.delete("/:id", practiceController.deleteLog);

export default router;
