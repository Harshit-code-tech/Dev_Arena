import { Router } from "express";
import * as projectController from "../controllers/project.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// --- Projects ---
// GET    /api/projects          -> List all projects for current user
// POST   /api/projects          -> Create a project
// PUT    /api/projects/:id      -> Update project status/details
router.get("/", projectController.getProjects);
router.post("/", projectController.createProject);
router.put("/:id", projectController.updateProject);

// --- Project Logs (work sessions) ---
// POST   /api/projects/:id/logs -> Add a work session
// PUT    /api/projects/:id/logs/:logId  -> Edit a work session
// DELETE /api/projects/:id/logs/:logId  -> Delete a work session
router.post("/:id/logs", projectController.addLog);
router.put("/:id/logs/:logId", projectController.updateLog);
router.delete("/:id/logs/:logId", projectController.deleteLog);

// --- Milestones ---
// POST   /api/projects/:id/milestones -> Add a milestone
// PUT    /api/projects/:id/milestones/:msId -> Mark complete / edit
router.post("/:id/milestones", projectController.addMilestone);
router.put("/:id/milestones/:msId", projectController.updateMilestone);

export default router;
