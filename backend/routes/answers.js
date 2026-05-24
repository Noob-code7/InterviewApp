import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { protect } from "../middleware/auth.js";
import { uploadAnswer } from "../controllers/answerController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For production we stream uploads to object storage. Keep memory storage
// and let the controller handle the transfer to S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
});

const router = Router();

router.use(protect);

router.post(
  "/:sessionId/answers/:questionId",
  upload.single("video"),
  uploadAnswer,
);

export default router;
