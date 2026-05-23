import { Router } from "express";
import * as fullstackController from "../controllers/fullstack.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// GET    /api/fullstack     -> Get all logs for current user
// POST   /api/fullstack     -> Create a new log
// PUT    /api/fullstack/:id -> Edit a log (within 24 hours)
// DELETE /api/fullstack/:id -> Delete a log (within 24 hours)
router.get("/", fullstackController.getLogs);
router.post("/", fullstackController.createLog);
router.put("/:id", fullstackController.updateLog);
router.delete("/:id", fullstackController.deleteLog);

export default router;
