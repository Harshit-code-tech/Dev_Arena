import { Router } from "express";
import * as projectController from "./project.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", projectController.getProjects);
router.post("/", projectController.createProject);
router.put("/:id", projectController.updateProject);

router.post("/:id/logs", projectController.addLog);
router.put("/:id/logs/:logId", projectController.updateLog);
router.delete("/:id/logs/:logId", projectController.deleteLog);

router.post("/:id/milestones", projectController.addMilestone);
router.put("/:id/milestones/:msId", projectController.updateMilestone);

export default router;
