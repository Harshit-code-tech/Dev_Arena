import { Router } from "express";
import * as practiceController from "./practice.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", practiceController.getLogs);
router.post("/", practiceController.createLog);
router.put("/:id", practiceController.updateLog);
router.delete("/:id", practiceController.deleteLog);

export default router;
