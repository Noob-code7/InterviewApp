import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { submitWriting } from "../controllers/writingController.js";

const router = Router();

router.use(protect);

router.post("/:sessionId/writing", submitWriting);

export default router;
