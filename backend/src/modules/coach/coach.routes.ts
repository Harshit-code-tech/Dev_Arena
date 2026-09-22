import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import { getCoachFeedback } from "./coach.controller";

const router = Router();

router.use(protect);
router.get("/", getCoachFeedback);

export default router;
