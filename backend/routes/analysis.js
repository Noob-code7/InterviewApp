import { Router } from "express";
import { startAnalysis } from "../services/analysisService.js";
import { protect } from "../middleware/auth.js";
import Session from "../models/Session.js";
import {
  transcribeAndEvaluate,
  evaluateOnly,
} from "../controllers/analysisController.js";

const router = Router();

// POST /api/analysis/:sessionId/start
router.post("/:sessionId/start", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    // Check ownership
    if (
      session.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Forbidden: You do not own this session",
        });
    }

    const success = await startAnalysis(sessionId);

    if (!success) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Analysis already queued or processing",
        });
    }

    // Return 202 Accepted immediately
    res
      .status(202)
      .json({ success: true, message: "Analysis job queued successfully" });
  } catch (error) {
    console.error("Error starting analysis:", error.message);
    res.status(500).json({ success: false, error: "Failed to start analysis" });
  }
});

// POST /api/analysis/voice — multipart audio upload, protected
router.post("/voice", protect, transcribeAndEvaluate);

// POST /api/analysis/evaluate — accept transcript + keywords and evaluate (protected)
router.post("/evaluate", protect, evaluateOnly);

export default router;
