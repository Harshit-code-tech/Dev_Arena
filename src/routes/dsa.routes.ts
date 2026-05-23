import { Router } from "express";
import * as dsaController from "../controllers/dsa.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

// All routes below require the user to be logged in
router.use(protect);

// GET    /api/dsa     -> Get all logs for current user
// POST   /api/dsa     -> Create a new log
// PUT    /api/dsa/:id -> Edit a log (within 24 hours)
// DELETE /api/dsa/:id -> Delete a log (within 24 hours)
router.get("/", dsaController.getLogs);
router.post("/", dsaController.createLog);
router.put("/:id", dsaController.updateLog);
router.delete("/:id", dsaController.deleteLog);

export default router;
