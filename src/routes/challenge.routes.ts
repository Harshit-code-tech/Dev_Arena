import { Router } from "express";
import * as challengeController from "../controllers/challenge.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// GET  /api/challenge         -> Get current week's challenge results
// POST /api/challenge/submit  -> Submit challenge result
router.get("/", challengeController.getResults);
router.post("/submit", challengeController.submitResult);

export default router;
