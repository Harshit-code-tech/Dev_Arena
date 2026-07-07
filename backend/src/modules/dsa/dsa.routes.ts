import { Router } from "express";
import * as dsaController from "./dsa.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", dsaController.getLogs);
router.post("/", dsaController.createLog);
router.put("/:id", dsaController.updateLog);
router.delete("/:id", dsaController.deleteLog);

export default router;
