import Session from "../models/Session.js";
import Question from "../models/Question.js";
import { sendSuccess, sendError } from "../utils/response.js";
import {
  HR_QUESTIONS,
  TECHNICAL_QUESTION_BANK,
  getTopicsForRole,
} from "../data/questionBanks.js";

function getRandomQuestions(bank, count) {
  const shuffled = [...bank].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
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
      return sendSuccess(
        res,
        { session, questions: session.answers },
        200,
        "Questions already generated",
      );
    }

    const type = session.interviewType || "mixed";
    const role = session.role || "";
    const userCollege = req.user.college || session.college || null;
    const count = session.questionCount || 5;

    // Handle Resume-Based Interview Mode — Dynamic Domain Tag & Resume Synthesis
    if (type === "resume") {
      try {
        const axios = (await import("axios")).default;
        const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";
        
        const nlpRes = await axios.post(`${NLP_SERVICE_URL}/generate-resume-questions`, {
          resumeText: session.resumeText || session.role || "Software Engineering Experience",
          role,
          count
        }, { timeout: 10000 });

        const nlpData = nlpRes.data?.data || {};
        const domainTags = nlpData.domainTags || [];
        const resumeQuestions = nlpData.questions || [];

        let matchedDbQuestions = [];
        if (domainTags.length > 0) {
          console.log(`[ResumeEngine] Extracted domain tags from resume: ${domainTags.join(", ")}`);
          matchedDbQuestions = await Question.find({ tags: { $in: domainTags } }).lean();
        }

        let combinedPool = [];

        // 1. First add default MongoDB questions matching the candidate's resume domain tags (e.g. DBMS, OOPS)
        if (matchedDbQuestions.length > 0) {
          console.log(`[ResumeEngine] Found ${matchedDbQuestions.length} MongoDB questions matching candidate resume domains (${domainTags.join(", ")})`);
          combinedPool.push(...matchedDbQuestions.map((q) => ({
            questionText: q.questionText,
            expectedKeywords: q.keywords || [],
            referenceAnswer: q.referenceAnswer || "",
          })));
        }

        // 2. Next add personalized resume project questions synthesized by NLP
        combinedPool.push(...resumeQuestions.map((q) => ({
          questionText: q.questionText,
          expectedKeywords: q.keywords || [],
          referenceAnswer: q.referenceAnswer || "",
        })));

        // Deduplicate combined pool by questionText
        const uniqueMap = new Map();
        combinedPool.forEach((q) => {
          if (q && q.questionText && !uniqueMap.has(q.questionText.trim().toLowerCase())) {
            uniqueMap.set(q.questionText.trim().toLowerCase(), q);
          }
        });
        let uniquePool = Array.from(uniqueMap.values());

        // If uniquePool is smaller than requested count, fill with default DB questions
        if (uniquePool.length < count) {
          const globalDbQuestions = await Question.find({
            $or: [{ college: null }, { college: { $exists: false } }],
          }).lean();

          globalDbQuestions.forEach((q) => {
            const normText = (q.questionText || "").trim().toLowerCase();
            if (normText && !uniqueMap.has(normText)) {
              uniqueMap.set(normText, {
                questionText: q.questionText,
                expectedKeywords: q.keywords || [],
                referenceAnswer: q.referenceAnswer || "",
              });
            }
          });
          uniquePool = Array.from(uniqueMap.values());
        }

        const selectedResumeQuestions = getRandomQuestions(uniquePool, Math.min(count, uniquePool.length));

        const answers = selectedResumeQuestions.map((q, idx) => ({
          questionId: `resume-q-${Date.now()}-${idx}`,
          questionText: q.questionText,
          expectedKeywords: q.expectedKeywords || [],
          referenceAnswer: q.referenceAnswer || "",
        }));

        const updatedSession = await Session.findByIdAndUpdate(
          session._id,
          { $set: { answers } },
          { new: true }
        );

        return sendSuccess(res, { session: updatedSession, questions: updatedSession.answers }, 201);
      } catch (resumeErr) {
        console.warn("[QuestionEngine] Resume question synthesis fallback:", resumeErr.message);
      }
    }

    let adminCustomQuestions = [];
    let defaultDbQuestions = [];

    try {
      // 1. Check for Admin/Faculty uploaded custom questions (matching college or tagged)
      const customQuery = {};
      if (userCollege) {
        customQuery.college = userCollege;
      }

      if (type === "hr") {
        customQuery.tags = { $in: ["hr", "behavioral"] };
      } else if (type === "technical") {
        const topics = getTopicsForRole(role);
        customQuery.tags = { $in: [...topics, "technical"] };
      }

      if (userCollege) {
        adminCustomQuestions = await Question.find(customQuery).lean();
      }

      // 2. Fetch default/global MongoDB questions as fallback pool
      const defaultQuery = {
        $or: [{ college: null }, { college: { $exists: false } }],
      };
      if (type === "hr") {
        defaultQuery.tags = { $in: ["hr", "behavioral"] };
      } else if (type === "technical") {
        const topics = getTopicsForRole(role);
        defaultQuery.tags = { $in: [...topics, "technical"] };
      }
      defaultDbQuestions = await Question.find(defaultQuery).lean();
    } catch (dbErr) {
      console.warn("MongoDB question query fallback:", dbErr.message);
    }

    // 3. Selection Hierarchy: Custom Admin Questions FIRST -> Default DB Questions SECOND -> Hardcoded Fallback THIRD
    let selectedPool = [];

    if (adminCustomQuestions && adminCustomQuestions.length > 0) {
      console.log(`[QuestionEngine] Found ${adminCustomQuestions.length} Admin/Faculty custom questions for college: ${userCollege}`);
      selectedPool = adminCustomQuestions.map((q) => ({
        questionText: q.questionText,
        expectedKeywords: q.keywords || [],
        referenceAnswer: q.referenceAnswer || "",
        isCustom: true,
      }));
    }

    // If custom questions are fewer than requested count, fill remaining from default MongoDB questions
    if (selectedPool.length < count && defaultDbQuestions.length > 0) {
      const defaultPool = defaultDbQuestions.map((q) => ({
        questionText: q.questionText,
        expectedKeywords: q.keywords || [],
        referenceAnswer: q.referenceAnswer || "",
        isCustom: false,
      }));

      // Shuffle default pool to pick unique non-duplicate questions
      const shuffledDefaults = getRandomQuestions(defaultPool, count - selectedPool.length);
      selectedPool = [...selectedPool, ...shuffledDefaults];
    }

    // Hardcoded static bank fallback if DB is completely empty
    if (selectedPool.length === 0) {
      let fallbackTextList = [];
      if (type === "hr") {
        fallbackTextList = HR_QUESTIONS;
      } else {
        const topics = getTopicsForRole(role);
        fallbackTextList = topics.flatMap((t) => TECHNICAL_QUESTION_BANK[t] || []);
      }

      selectedPool = fallbackTextList.map((txt) => ({
        questionText: txt,
        expectedKeywords: [],
        referenceAnswer: "",
        isCustom: false,
      }));
    }

    const finalSelected = getRandomQuestions(selectedPool, count);

    // Fill remaining if pool size was smaller than count
    while (finalSelected.length < count && selectedPool.length > 0) {
      finalSelected.push(selectedPool[Math.floor(Math.random() * selectedPool.length)]);
    }

    const answers = finalSelected.map((q, index) => ({
      questionId: `q-${Date.now()}-${index}`,
      questionText: q.questionText,
      expectedKeywords: q.expectedKeywords || [],
      referenceAnswer: q.referenceAnswer || "",
    }));

    const updatedSession = await Session.findByIdAndUpdate(
      session._id,
      { $set: { answers } },
      { new: true }
    );

    return sendSuccess(res, { session: updatedSession, questions: updatedSession.answers }, 201);
  } catch (err) {
    console.error("ERROR IN GENERATE QUESTIONS:", err);
    return sendError(res, err.message, 500);
  }
};

export default { generateQuestions };
