import QuestionHistory from "../models/QuestionHistory.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * Record question history when questions are genuinely delivered to the candidate
 * This should be called when the interview actually starts delivering questions
 */
export const recordQuestionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return sendError(res, "questions array is required", 400);
    }

    const userId = req.user._id;

    const bulkOps = questions
      .map((q) => {
        const qId = q._id || q.questionId;
        if (!qId) return null;

        return {
          updateOne: {
            filter: { userId, questionId: qId },
            update: {
              $inc: { timesAsked: 1 },
              $set: {
                questionText: q.questionText,
                tags: q.tags || [],
                track: q.track || "subject",
                askedAt: new Date(),
              },
              $setOnInsert: {
                userId,
                questionId: qId,
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (bulkOps.length > 0) {
      await QuestionHistory.bulkWrite(bulkOps, { ordered: false });
    }

    return sendSuccess(res, { recorded: bulkOps.length }, 200);
  } catch (err) {
    console.error("[QuestionHistory] Error recording history:", err);
    return sendError(res, err.message, 500);
  }
};

/**
 * Get user's question history for specific tags
 */
export const getUserQuestionHistory = async (req, res) => {
  try {
    const { tags } = req.query;
    const userId = req.user._id;

    if (!tags) {
      return sendError(res, "tags query parameter is required", 400);
    }

    const tagArray = Array.isArray(tags) ? tags : tags.split(",");

    const history = await QuestionHistory.find({
      userId,
      tags: { $in: tagArray },
    })
      .sort({ askedAt: -1 })
      .lean();

    return sendSuccess(res, { history }, 200);
  } catch (err) {
    console.error("[QuestionHistory] Error fetching history:", err);
    return sendError(res, err.message, 500);
  }
};

/**
 * Get question history statistics for a user
 */
export const getQuestionHistoryStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await QuestionHistory.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
          totalTimesAsked: { $sum: "$timesAsked" },
          lastAsked: { $max: "$askedAt" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const totalQuestions = await QuestionHistory.countDocuments({ userId });
    const uniqueQuestions = await QuestionHistory.distinct("questionId", { userId });

    return sendSuccess(
      res,
      {
        totalRecords: stats.length,
        totalQuestions,
        uniqueQuestions: uniqueQuestions.length,
        byTag: stats,
      },
      200
    );
  } catch (err) {
    console.error("[QuestionHistory] Error fetching stats:", err);
    return sendError(res, err.message, 500);
  }
};

export default {
  recordQuestionHistory,
  getUserQuestionHistory,
  getQuestionHistoryStats,
};
