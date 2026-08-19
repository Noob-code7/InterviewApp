import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { startAnalysis } from "../services/analysisService.js";

const DEFAULT_WRITING_TASKS = {
  frontend: "Explain how you would design a responsive, accessible component architecture for a real-time web application. Detail your state management and performance optimization strategy.",
  backend: "Describe how you would design a scalable, fault-tolerant rate limiting service for high-traffic REST APIs. Detail database indexing, caching strategies, and concurrency handling.",
  fullstack: "Walk through the architectural design of an end-to-end web application handling real-time audio/video streaming. Cover API gateway setup, backend queue workers, and database schemas.",
  default: "Describe a complex technical challenge you solved recently. Explain your problem-solving process, architectural trade-offs made, and the key lessons learned."
};

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

    if (!session.writingTask) {
      const roleKey = (session.role || "").toLowerCase();
      session.writingTask = DEFAULT_WRITING_TASKS[roleKey] || DEFAULT_WRITING_TASKS.default;
    }

    session.writingSubmission = text;
    session.status = "processing";
    session.jobStatus = "queued";
    await session.save();

    try {
      await startAnalysis(sessionId);
    } catch (err) {
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
