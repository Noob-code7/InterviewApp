import Question from "../../models/Question.js";
import { sendSuccess, sendError } from "../../utils/response.js";

// POST /api/admin/questions
export const createQuestion = async (req, res) => {
  try {
    const {
      questionText,
      referenceAnswer,
      keywords,
      testcases,
      college,
      tags,
    } = req.body;
    if (!questionText) return sendError(res, "questionText is required", 400);

    const q = await Question.create({
      questionText,
      referenceAnswer: referenceAnswer || "",
      keywords: Array.isArray(keywords)
        ? keywords
        : keywords
          ? keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      testcases: Array.isArray(testcases)
        ? testcases
        : testcases
          ? JSON.parse(testcases)
          : [],
      college: college || req.user?.college || null,
      tags: Array.isArray(tags)
        ? tags
        : tags
          ? tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      createdBy: req.user?._id,
    });

    return sendSuccess(res, { question: q }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// GET /api/admin/questions?college=xyz
export const listQuestions = async (req, res) => {
  try {
    const { college, q } = req.query;
    const filter = {};
    if (college) filter.college = college;
    if (q) filter.questionText = { $regex: q, $options: "i" };
    const items = await Question.find(filter)
      .sort({ createdAt: -1 })
      .limit(500);
    return sendSuccess(res, { questions: items });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// GET /api/admin/questions/:id
export const getQuestion = async (req, res) => {
  try {
    const q = await Question.findById(req.params.id);
    if (!q) return sendError(res, "Not found", 404);
    return sendSuccess(res, { question: q });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// PUT /api/admin/questions/:id
export const updateQuestion = async (req, res) => {
  try {
    const updates = req.body;
    if (updates.keywords && !Array.isArray(updates.keywords)) {
      updates.keywords = updates.keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const q = await Question.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    if (!q) return sendError(res, "Not found", 404);
    return sendSuccess(res, { question: q });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

// DELETE /api/admin/questions/:id
export const deleteQuestion = async (req, res) => {
  try {
    const q = await Question.findByIdAndDelete(req.params.id);
    if (!q) return sendError(res, "Not found", 404);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};
