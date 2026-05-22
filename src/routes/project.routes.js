const express = require("express");
const router = express.Router();
const projectController = require("../controllers/project.controller");
const { protect } = require("../middleware/auth.middleware");

router.use(protect);

// --- Projects ---
// GET    /api/projects          → list all projects for current user
// POST   /api/projects          → create a project
// PUT    /api/projects/:id      → update project status/details
router.get("/", projectController.getProjects);
router.post("/", projectController.createProject);
router.put("/:id", projectController.updateProject);

// --- Project Logs (work sessions) ---
// POST   /api/projects/:id/logs → add a work session
// PUT    /api/projects/:id/logs/:logId  → edit a work session
// DELETE /api/projects/:id/logs/:logId  → delete a work session
router.post("/:id/logs", projectController.addLog);
router.put("/:id/logs/:logId", projectController.updateLog);
router.delete("/:id/logs/:logId", projectController.deleteLog);

// --- Milestones ---
// POST   /api/projects/:id/milestones          → add a milestone
// PUT    /api/projects/:id/milestones/:msId    → mark complete / edit
router.post("/:id/milestones", projectController.addMilestone);
router.put("/:id/milestones/:msId", projectController.updateMilestone);

module.exports = router;
