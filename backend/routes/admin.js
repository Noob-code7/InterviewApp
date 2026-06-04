import { Router } from "express";
import { protect, restrict } from "../middleware/auth.js";
import {
  createQuestion,
  listQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controllers/admin/questionsController.js";

const router = Router();

// All admin routes require authentication + faculty or admin role
router.use(protect);
router.use(restrict("faculty", "admin"));

router.post("/questions", createQuestion);
router.get("/questions", listQuestions);
router.get("/questions/:id", getQuestion);
router.put("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);

export default router;
