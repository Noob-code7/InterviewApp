import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";
import storage from "../services/storage.js";

// ── POST /api/sessions/:sessionId/answers/:questionId ──────────────────────────
export const uploadAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const {
      videoUrl: bodyVideoUrl,
      storageKey,
      questionText,
      questionIndex: bodyQuestionIndex,
      isFollowUp,
      turn,
    } = req.body || {};

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

    const isSyntheticFollowUp = String(questionId).includes("-followup-");
    const isFollowUpReq = isFollowUp === true || isFollowUp === "true" || isSyntheticFollowUp;

    let targetParentId = String(questionId);
    let derivedTurn = turn ? parseInt(turn, 10) : 1;

    if (isSyntheticFollowUp) {
      const parts = String(questionId).split("-followup-");
      targetParentId = parts[0];
      if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
        derivedTurn = parseInt(parts[1], 10);
      }
    }

    // Multi-strategy Slot Matcher
    let parentIndex = session.answers.findIndex(
      (a) => String(a.questionId) === targetParentId || String(a._id) === targetParentId
    );

    // Strategy 2: Match by explicit questionIndex
    if (parentIndex === -1 && bodyQuestionIndex !== undefined && bodyQuestionIndex !== null) {
      const qIdx = parseInt(bodyQuestionIndex, 10);
      if (!isNaN(qIdx) && qIdx >= 0 && qIdx < session.answers.length) {
        parentIndex = qIdx;
      }
    }

    // Strategy 3: Match by trailing index in questionId (e.g. `resume-q-...-0` -> slot 0)
    if (parentIndex === -1 && targetParentId.includes("-")) {
      const trailing = targetParentId.split("-").pop();
      const trailingIdx = parseInt(trailing, 10);
      if (!isNaN(trailingIdx) && trailingIdx >= 0 && trailingIdx < session.answers.length) {
        parentIndex = trailingIdx;
      }
    }

    // Follow-up answers are saved inside parentAnswer.followUps
    if (isFollowUpReq) {
      if (parentIndex === -1) {
        return sendError(res, "Parent project question not found for follow-up", 404);
      }
      const parent = session.answers[parentIndex];
      parent.followUps.push({
        questionText: questionText || "Project Technical Follow-up",
        turn: derivedTurn || parent.followUps.length + 1,
        startedAt: new Date(),
        completedAt: new Date(),
        videoUrl,
        audioUrl,
      });
      await session.save();
      const followUp = parent.followUps[parent.followUps.length - 1];
      return sendSuccess(res, { answer: parent, followUp });
    }

    // Regular question answer update
    let answerIndex = parentIndex;

    if (answerIndex === -1) {
      // If questions are already populated, don't append a phantom question
      // Match first empty slot or fallback to index 0
      const firstEmptySlot = session.answers.findIndex((a) => !a.videoUrl && !a.audioUrl);
      if (firstEmptySlot !== -1) {
        answerIndex = firstEmptySlot;
      } else if (session.answers.length < (session.questionCount || 5)) {
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
        // Safe fallback: update the last slot instead of expanding beyond count
        answerIndex = session.answers.length - 1;
      }
    }

    session.answers[answerIndex].videoUrl = videoUrl;
    session.answers[answerIndex].audioUrl = audioUrl;
    session.answers[answerIndex].completedAt = new Date();

    await session.save();

    return sendSuccess(res, { answer: session.answers[answerIndex] });
  } catch (err) {
    console.error("uploadAnswer error:", err);
    return sendError(res, err.message, 500);
  }
};
