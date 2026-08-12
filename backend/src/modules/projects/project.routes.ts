import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as projectController from "./project.controller";

const router = Router();

router.get("/shared/:shareSlug", projectController.getSharedProject);

router.use(protect);
router.get("/", projectController.getProjects);
router.post("/", projectController.createProject);
router.post("/github/reverify", projectController.reverifyGitHubRepositories);
router.put("/:id", projectController.updateProject);
router.put("/:id/sharing", projectController.updateSharing);
router.post("/:id/github", projectController.attachGitHubRepository);
router.post("/:id/github/refresh", projectController.refreshGitHubRepository);

router.post("/:id/logs", projectController.addLog);
router.put("/:id/logs/:logId", projectController.updateLog);
router.delete("/:id/logs/:logId", projectController.deleteLog);

router.post("/:id/milestones", projectController.addMilestone);
router.put("/:id/milestones/:msId", projectController.updateMilestone);

export default router;
