import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as controller from "./tournament.controller";

const router = Router();
router.use(protect);
router.get("/", controller.listTournaments);
router.get("/leaderboard", controller.getGlobalLeaderboard);
router.get("/:tournamentId", controller.getTournament);
router.get("/:tournamentId/leaderboard", controller.getLeaderboard);
router.post("/:tournamentId/register", controller.registerTournament);
router.post("/:tournamentId/dsa-submissions", controller.submitDsa);
router.post("/:tournamentId/project-submission", controller.saveProjectSubmission);
export default router;
