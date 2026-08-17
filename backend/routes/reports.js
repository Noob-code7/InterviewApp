import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getReport } from "../controllers/reportController.js";

const router = Router();

router.use(protect);

router.get("/:sessionId", getReport);

export default router;
