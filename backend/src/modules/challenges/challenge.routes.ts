import { Router } from "express";
import * as challengeController from "./challenge.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", challengeController.getResults);
router.post("/submit", challengeController.submitResult);

export default router;
