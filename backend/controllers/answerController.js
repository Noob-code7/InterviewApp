import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";
import storage from "../services/storage.js";

// ── POST /api/sessions/:sessionId/answers/:questionId ───────────────────────
export const uploadAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const { videoUrl: bodyVideoUrl, storageKey, questionText } = req.body || {};

    let videoUrl = bodyVideoUrl || "";
    let audioUrl = videoUrl;

    // If no direct videoUrl was passed in body, handle file upload
    if (!videoUrl) {
      if (!req.file || !req.file.buffer) {
        return sendError(res, "No video file uploaded or videoUrl provided", 400);
      }

      const allowed = [
        "video/webm",
        "audio/webm",
        "video/mp4",
        "audio/mpeg",
        "audio/wav",
        "application/octet-stream",
      ];
      if (req.file.mimetype && !allowed.includes(req.file.mimetype)) {
        return sendError(res, "Unsupported media type", 415);
      }

      const filename = req.file.originalname || `answer.webm`;
      const key = storage.makeKeyForAnswer(sessionId, filename);
      let uploadRes;
      try {
        uploadRes = await storage.uploadBuffer(
          req.file.buffer,
          key,
          req.file.mimetype || "video/webm",
        );
        videoUrl = uploadRes.url;
        audioUrl = videoUrl;
      } catch (err) {
        console.error("Storage upload failed:", err);
        return sendError(res, "Failed to store uploaded file", 500);
      }
    }

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
    });
    if (!session) return sendError(res, "Session not found", 404);

    let answerIndex = session.answers.findIndex(
      (a) => String(a.questionId) === String(questionId) || String(a._id) === String(questionId)
    );

    if (answerIndex === -1) {
      session.answers.push({
        questionId: String(questionId),
        questionText: questionText || "Interview Question",
        startedAt: new Date(),
        completedAt: new Date(),
        videoUrl,
        audioUrl,
      });
      answerIndex = session.answers.length - 1;
    } else {
      session.answers[answerIndex].videoUrl = videoUrl;
      session.answers[answerIndex].audioUrl = audioUrl;
      session.answers[answerIndex].completedAt = new Date();
    }

    await session.save();

    return sendSuccess(res, { answer: session.answers[answerIndex] });
  } catch (err) {
    console.error("uploadAnswer error:", err);
    return sendError(res, err.message, 500);
  }
};
