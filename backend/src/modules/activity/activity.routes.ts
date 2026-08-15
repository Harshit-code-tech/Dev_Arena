import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import { getDayActivity } from "./activity.controller";

const router = Router();
router.get("/:date", protect, getDayActivity);
export default router;
