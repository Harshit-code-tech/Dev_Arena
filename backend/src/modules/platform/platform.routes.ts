import { Router } from "express";
import { getPulse } from "./platform.controller";

const router = Router();
router.get("/pulse", getPulse);
export default router;
