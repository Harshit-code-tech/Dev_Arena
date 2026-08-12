import { Router } from "express";
import * as fullstackController from "./fullstack.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.get("/", fullstackController.getLogs);
router.post("/", fullstackController.createLog);
router.put("/:id", fullstackController.updateLog);
router.delete("/:id", fullstackController.deleteLog);

export default router;
