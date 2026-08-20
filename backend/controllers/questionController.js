import Question from "../models/Question.js";
import Session from "../models/Session.js";
import QuestionHistory from "../models/QuestionHistory.js";
import {
  TECHNICAL_QUESTION_BANK,
  HR_QUESTIONS,
  getTopicsForRole,
  getRandomQuestions,
} from "../data/questionBanks.js";
import { generateProjectQuestions } from "../services/llmService.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * Get user's question history for specific tags
 * Returns a map of questionId -> history record for quick lookup
 */
async function getUserQuestionHistory(userId, tags) {
  const history = await QuestionHistory.find({
    userId,
    tags: { $in: tags },
  }).lean();

  const historyMap = new Map();
  for (const record of history) {
    historyMap.set(record.questionId.toString(), record);
  }
  return historyMap;
}

/**
 * Smart question selection with per-user history
 * Priority 1: Never asked questions
 * Priority 2: Least recently asked, then least frequently asked
 */
async function selectQuestionsWithHistory(
  userId,
  candidateQuestions,
  count,
  tags,
  sessionId
) {
  if (candidateQuestions.length === 0) return [];

  // Get user's question history for these tags
  const historyMap = await getUserQuestionHistory(userId, tags);

  // Separate questions into unseen and seen
  const unseenQuestions = [];
  const seenQuestions = [];

  for (const q of candidateQuestions) {
    const qId = q._id ? q._id.toString() : q.questionId;
    if (historyMap.has(qId)) {
      seenQuestions.push({ question: q, history: historyMap.get(qId) });
    } else {
      unseenQuestions.push(q);
    }
  }

  // Shuffle unseen questions for randomness
  const shuffledUnseen = [...unseenQuestions].sort(() => 0.5 - Math.random());

  // If we have enough unseen questions, use them
  if (shuffledUnseen.length >= count) {
    return shuffledUnseen.slice(0, count).map((q) => ({
      ...q,
      isNew: true,
    }));
  }

  // Not enough unseen questions - use all unseen + fill from seen with rotation
  const selected = [...shuffledUnseen].map((q) => ({ ...q, isNew: true }));
  const remaining = count - selected.length;

  if (remaining > 0 && seenQuestions.length > 0) {
    // Sort seen questions by: least recently asked, then least frequently asked
    seenQuestions.sort((a, b) => {
      // First: least recently asked (older askedAt comes first)
      const timeDiff = new Date(a.history.askedAt).getTime() - new Date(b.history.askedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Second: least frequently asked
      return a.history.timesAsked - b.history.timesAsked;
    });

    // Add from seen questions
    for (let i = 0; i < remaining && i < seenQuestions.length; i++) {
      selected.push({
        ...seenQuestions[i].question,
        isNew: false,
        history: seenQuestions[i].history,
      });
    }
  }

  return selected.slice(0, count);
}

/**
 * Record question history when questions are genuinely delivered
 */
async function recordQuestionHistory(userId, questions, sessionId) {
  if (!questions || questions.length === 0) return;

  const bulkOps = questions.map((q) => {
    const qId = q._id ? q._id.toString() : q.questionId;
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
            questionId: q._id,
          },
        },
        upsert: true,
      };
    });

  if (bulkOps.length > 0) {
    await QuestionHistory.bulkWrite(bulkOps, { ordered: false });
  }
}

import Question from "../models/Question.js";
import Session from "../models/Session.js";
import QuestionHistory from "../models/QuestionHistory.js";
import {
  TECHNICAL_QUESTION_BANK,
  HR_QUESTIONS,
  getTopicsForRole,
  getRandomQuestions,
} from "../data/questionBanks.js";
import { generateProjectQuestions } from "../services/llmService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const generateQuestions = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
    });

    if (!session) return sendError(res, "Session not found", 404);

    // Fast-path: Return existing questions immediately if already generated
    if (session.answers && session.answers.length > 0) {
      return sendSuccess(
        res,
        { session, questions: session.answers },
        200,
        "Questions already generated"
      );
    }

    const type = session.interviewType || "mixed";
    const role = session.role || "";
    const userCollege = req.user.college || session.college || null;
    const count = session.questionCount || 5;
    const userId = req.user._id;

    // ── Multi-Track Resume Interview Assembly ────────────────────────────────
    if (type === "resume") {
      try {
        const axios = (await import("axios")).default;
        const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";

        const nlpRes = await axios.post(
          `${NLP_SERVICE_URL}/generate-resume-questions`,
          {
            resumeText: session.resumeText || session.role || "Software Engineering Experience",
            role,
            count,
          },
          { timeout: 35000 }
        );

        const nlpData = nlpRes.data?.data || {};
        const domainTags = nlpData.domainTags || [];
        const resumeProjects = nlpData.projects || [];
        let projectQuestions = (nlpData.questions || []).filter((q) => q.track === "project");
        const fallbackResumeQuestions = nlpData.questions || [];

        // Determine dynamic project question allocation (e.g., 2-3 project questions)
        const targetProjectCount = Math.max(2, Math.min(resumeProjects.length > 1 ? 3 : 2, count - 2));

        // Track 3: Prefer LLM-generated project questions grounded in the resume projects
        if (resumeProjects.length > 0) {
          try {
            const llmProjectQuestions = await generateProjectQuestions(
              resumeProjects,
              role,
              targetProjectCount,
              {
                sessionId: session._id.toString(),
                sessionIndex: 0,
                previousQuestions: [],
              }
            );
            if (Array.isArray(llmProjectQuestions) && llmProjectQuestions.length > 0) {
              projectQuestions = llmProjectQuestions;
            }
          } catch (llmProjErr) {
            console.warn("[QuestionEngine] LLM project question generation failed, using resume templates:", llmProjErr.message);
          }
        }

        const assembledQuestions = [];

        // Track 1: HR Behavioral Question (1 question from DB)
        const hrDbQuestions = await Question.find({
          $or: [{ track: "hr" }, { tags: { $in: ["hr", "behavioral"] } }],
        }).lean();

        if (hrDbQuestions.length > 0) {
          const selectedHr = getRandomQuestions(hrDbQuestions, 1)[0];
          assembledQuestions.push({
            questionText: selectedHr.questionText,
            track: "hr",
            expectedKeywords: selectedHr.keywords || [],
            expectedConcepts: selectedHr.expectedConcepts || [],
            referenceAnswer: selectedHr.referenceAnswer || "",
          });
        }

        // Track 2: Core Subject Questions matching Resume Skills (from DB)
        let subjectQuery = {
          $or: [{ college: null }, { college: { $exists: false } }],
        };
        if (domainTags.length > 0) {
          subjectQuery.tags = { $in: domainTags };
        } else {
          subjectQuery.tags = { $in: ["os", "dbms", "oop", "networking", "ds"] };
        }

        const subjectDbQuestions = await Question.find(subjectQuery).lean();
        const targetSubjectCount = Math.max(1, count - 1 - Math.min(projectQuestions.length || 2, targetProjectCount));

        if (subjectDbQuestions.length > 0) {
          // Use smart selection for resume mode subject questions
          const selectedSubjects = await selectQuestionsWithHistory(
            req.user._id,
            subjectDbQuestions,
            targetSubjectCount,
            ["os", "dbms", "oop", "networking", "ds"],
            session._id
          );
          for (const s of selectedSubjects) {
            assembledQuestions.push({
              questionText: s.questionText,
              track: "subject",
              expectedKeywords: s.expectedKeywords || [],
              expectedConcepts: s.expectedConcepts || [],
              referenceAnswer: s.referenceAnswer || "",
            });
          }
        }

        // Track 3: Project-Specific Questions from Resume Projects
        if (projectQuestions.length > 0) {
          for (const p of projectQuestions.slice(0, targetProjectCount)) {
            assembledQuestions.push({
              questionText: p.questionText,
              track: "project",
              dimension: p.dimension || "architecture",
              expectedKeywords: p.keywords || p.expectedKeywords || [],
              expectedConcepts: p.expectedConcepts || [],
              referenceAnswer: p.referenceAnswer || "",
              projectContext: p.projectContext || null,
            });
          }
        } else if (fallbackResumeQuestions.length > 0) {
          for (const f of fallbackResumeQuestions.slice(0, targetProjectCount)) {
            assembledQuestions.push({
              questionText: f.questionText,
              track: f.track || "project",
              dimension: f.dimension || "architecture",
              expectedKeywords: f.keywords || f.expectedKeywords || [],
              expectedConcepts: f.expectedConcepts || [],
              referenceAnswer: f.referenceAnswer || "",
              projectContext: f.projectContext || null,
            });
          }
        }

        // Deduplicate assembled questions by question text
        const uniqueMap = new Map();
        assembledQuestions.forEach((q) => {
          if (q && q.questionText && !uniqueMap.has(q.questionText.trim().toLowerCase())) {
            uniqueMap.set(q.questionText.trim().toLowerCase(), q);
          }
        });
        let finalResumePool = Array.from(uniqueMap.values());

        // Pad if needed up to requested count
        if (finalResumePool.length < count) {
          const extraDbQuestions = await Question.find({
            $or: [{ college: null }, { college: { $exists: false } }],
          }).lean();
          for (const extra of extraDbQuestions) {
            if (finalResumePool.length >= count) break;
            const norm = extra.questionText.trim().toLowerCase();
            if (!uniqueMap.has(norm)) {
              uniqueMap.set(norm, extra);
              finalResumePool.push({
                questionText: extra.questionText,
                track: extra.track || "subject",
                expectedKeywords: extra.keywords || [],
                expectedConcepts: extra.expectedConcepts || [],
                referenceAnswer: extra.referenceAnswer || "",
              });
            }
          }
        }

        // Deterministic question IDs keyed by session ID and index
        const answers = finalResumePool.slice(0, count).map((q, idx) => ({
          questionId: `resume-q-${session._id}-${idx}`,
          questionText: q.questionText,
          track: q.track || "subject",
          dimension: q.dimension || null,
          expectedKeywords: q.expectedKeywords || [],
          expectedConcepts: q.expectedConcepts || [],
          referenceAnswer: q.referenceAnswer || "",
          projectContext: q.projectContext || null,
        }));

        // Concurrency Guard: Check if another request finished first
        const freshSession = await Session.findById(session._id);
        if (freshSession && freshSession.answers && freshSession.answers.length > 0) {
          return sendSuccess(res, { session: freshSession, questions: freshSession.answers }, 200);
        }

        const updatedSession = await Session.findByIdAndUpdate(
          session._id,
          { $set: { answers } },
          { new: true }
        );

        console.log(`[ResumeEngine] Assembled ${answers.length} multi-track questions for Session ${session._id}`);
        return sendSuccess(res, { session: updatedSession, questions: updatedSession.answers }, 201);
      } catch (resumeErr) {
        console.warn("[QuestionEngine] Resume question synthesis error, falling back:", resumeErr.message);
      }
    }

    // ── Standard Technical & HR Interview Modes ──────────────────────────────
    let adminCustomQuestions = [];
    let defaultDbQuestions = [];

    try {
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

    let selectedPool = [];

    if (adminCustomQuestions && adminCustomQuestions.length > 0) {
      selectedPool = adminCustomQuestions.map((q) => ({
        questionText: q.questionText,
        track: q.track || (type === "hr" ? "hr" : "subject"),
        expectedKeywords: q.keywords || [],
        expectedConcepts: q.expectedConcepts || [],
        referenceAnswer: q.referenceAnswer || "",
        isCustom: true,
        _id: q._id,
        tags: q.tags,
        track: q.track,
      }));
    }

    if (selectedPool.length < count && defaultDbQuestions.length > 0) {
      const defaultPool = defaultDbQuestions.map((q) => ({
        questionText: q.questionText,
        track: q.track || (type === "hr" ? "hr" : "subject"),
        expectedKeywords: q.keywords || [],
        expectedConcepts: q.expectedConcepts || [],
        referenceAnswer: q.referenceAnswer || "",
        isCustom: false,
        _id: q._id,
        tags: q.tags,
        track: q.track,
      }));

      // Use smart selection for default questions
      const needed = count - selectedPool.length;
      const smartSelected = await selectQuestionsWithHistory(
        req.user._id,
        defaultPool,
        needed,
        defaultQuery.tags ? defaultQuery.tags.$in : ["os", "dbms", "oop", "networking", "ds"],
        session._id
      );

      selectedPool = [...selectedPool, ...smartSelected];
    }

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
        track: type === "hr" ? "hr" : "subject",
        expectedKeywords: [],
        expectedConcepts: [],
        referenceAnswer: "",
        isCustom: false,
      }));
    }

    const finalSelected = selectedPool.slice(0, count);

    // Record question history for genuinely delivered questions
    await recordQuestionHistory(req.user._id, finalSelected, session._id);

    // Deterministic question IDs keyed by session ID and index
    const answers = finalSelected.map((q, index) => ({
      questionId: `q-${session._id}-${index}`,
      questionText: q.questionText,
      track: q.track || (type === "hr" ? "hr" : "subject"),
      expectedKeywords: q.expectedKeywords || [],
      expectedConcepts: q.expectedConcepts || [],
      referenceAnswer: q.referenceAnswer || "",
      isNew: q.isNew || false,
    }));

    // Concurrency Guard: Check if another request finished first
    const freshSession = await Session.findById(session._id);
    if (freshSession && freshSession.answers && freshSession.answers.length > 0) {
      return sendSuccess(res, { session: freshSession, questions: freshSession.answers }, 200);
    }

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