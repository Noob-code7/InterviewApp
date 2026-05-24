import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { startAnalysis } from "../services/analysisService.js";

export const submitWriting = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return sendError(res, "Text is required", 400);
    }
    if (text.length > 5000) return sendError(res, "Text too long", 400);

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
    });
    if (!session) return sendError(res, "Session not found", 404);

    session.writingSubmission = text;
    session.status = "processing";
    session.jobStatus = "queued";
    await session.save();

    // Enqueue analysis job (reuse existing startAnalysis)
    try {
      await startAnalysis(sessionId);
    } catch (err) {
      // If enqueue fails, mark session as failed
      session.jobStatus = "failed";
      session.status = "failed";
      await session.save();
      return sendError(res, "Failed to enqueue analysis", 503);
    }

    return sendSuccess(res, { session }, 202);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

export default { submitWriting };
