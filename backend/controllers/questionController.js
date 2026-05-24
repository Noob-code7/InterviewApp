import Session from "../models/Session.js";
import { sendSuccess, sendError } from "../utils/response.js";
import {
  HR_QUESTIONS,
  TECHNICAL_QUESTION_BANK,
  getTopicsForRole,
} from "../data/questionBanks.js";
import Question from "../models/Question.js";

function getRandomQuestions(bank, count) {
  const shuffled = [...bank].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function uniqueQuestions(list) {
  return [...new Set(list.map((item) => item.trim()))];
}

function buildTechnicalBank(role = "") {
  const topics = getTopicsForRole(role);
  const questions = topics.flatMap(
    (topic) => TECHNICAL_QUESTION_BANK[topic] || [],
  );
  return uniqueQuestions(questions);
}

function buildMixedBank(role = "") {
  return uniqueQuestions([...HR_QUESTIONS, ...buildTechnicalBank(role)]);
}

// ── POST /api/sessions/:sessionId/questions ─────────────────────────────────
export const generateQuestions = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!req.user) {
      return sendError(res, "Access token required", 401);
    }

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
    });

    if (!session) return sendError(res, "Session not found", 404);
    if (session.answers && session.answers.length > 0) {
      return sendSuccess(res, { session }, 200, "Questions already generated");
    }

    const type = session.interviewType || "mixed";
    const role = session.role || "";

    let bank = [];
    if (type === "hr") {
      bank = HR_QUESTIONS;
    } else if (type === "technical") {
      bank = buildTechnicalBank(role);
      // Include faculty-uploaded questions for this user's college if any
      try {
        const collegeQuestions = await Question.find({
          college: session.user?.college || session.college || null,
        });
        if (collegeQuestions && collegeQuestions.length) {
          bank = [...collegeQuestions.map((q) => q.questionText), ...bank];
        }
      } catch (err) {
        // ignore DB lookup errors and continue with default bank
        console.error(
          "Failed to load college-specific questions:",
          err.message,
        );
      }
    } else if (type === "mixed") {
      bank = buildMixedBank(role);
    } else if (type === "resume") {
      bank = [
        `Can you walk me through your experience relevant to ${role || "this role"}?`,
        `Which project on your resume best shows your fit for ${role || "this role"}?`,
        "What was the hardest part of one project you worked on?",
        "Why did you choose to work on that project?",
        "What would you do differently if you rebuilt it today?",
      ];
    } else if (type === "company") {
      bank = [
        `Why are you interested in this company and the ${role || "target"} role?`,
        "How do you think your background matches our team needs?",
        "What do you hope to learn here in the next year?",
        "How do you make yourself useful when joining a new team?",
        "What kind of impact do you want to make here?",
      ];
    }

    if (!bank.length) {
      bank = buildMixedBank(role);
    }

    const count = session.questionCount || 5;
    const selectedQuestions = getRandomQuestions(bank, count);

    // Fallback if we need more questions than the bank has
    while (selectedQuestions.length < count) {
      const fallback = bank[Math.floor(Math.random() * bank.length)];
      selectedQuestions.push(fallback);
    }

    const answers = selectedQuestions.map((q, index) => ({
      questionId: `q-${Date.now()}-${index}`,
      questionText: q,
    }));

    session.answers = answers;
    await session.save();

    return sendSuccess(res, { session }, 201);
  } catch (err) {
    console.error("ERROR IN GENERATE QUESTIONS:", err);
    return sendError(res, err.message, 500);
  }
};
