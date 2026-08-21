import Question from "../models/Question.js";
import Session from "../models/Session.js";
import QuestionHistory from "../models/QuestionHistory.js";
import {
  TECHNICAL_QUESTION_BANK,
  HR_QUESTIONS,
  INTRODUCTORY_QUESTIONS,
  getIntroductoryQuestion,
  getTopicsForRole,
  getRandomQuestions,
} from "../data/questionBanks.js";
import {
  generateProjectQuestions,
  generateTechnicalQuestions,
  generateHRQuestions,
} from "../services/llmService.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * Canonical subject tags shared by the question bank, Session.subjectsOfInterest
 * and the Subject of Interest setup UI.
 */
const SUBJECT_TAGS = ["os", "dbms", "networking", "oop", "se", "ds"];

/**
 * History-aware selection distributed evenly across the candidate's selected
 * subjects. Each subject pool is ranked by the existing least-asked/history
 * logic, then results are interleaved round-robin so no single subject
 * dominates when multiple subjects are selected.
 */
async function selectDistributedQuestions(
  userId,
  pool,
  subjects,
  count,
  sessionId = null
) {
  if (!pool || pool.length === 0 || !subjects || subjects.length === 0) return [];

  const rankedLists = [];
  for (const subject of subjects) {
    const subjectPool = pool.filter((q) => (q.tags || []).includes(subject));
    if (subjectPool.length === 0) continue;
    const ranked = await selectQuestionsWithHistory(
      userId,
      subjectPool,
      count,
      [subject],
      sessionId
    );
    if (ranked.length > 0) rankedLists.push(ranked);
  }

  // Round-robin interleave: one question per subject per pass until filled
  const ordered = [];
  for (let i = 0; ordered.length < count; i++) {
    let addedThisPass = false;
    for (const list of rankedLists) {
      if (ordered.length >= count) break;
      if (i < list.length) {
        ordered.push(list[i]);
        addedThisPass = true;
      }
    }
    if (!addedThisPass) break;
  }

  return ordered;
}

/**
 * Get user's question history
 * Returns a map of questionId / questionText -> history record for fast lookup
 */
async function getUserQuestionHistory(userId, tags = []) {
  try {
    const query = { userId };
    if (tags && Array.isArray(tags) && tags.length > 0) {
      query.tags = { $in: tags };
    }
    const history = await QuestionHistory.find(query).lean();

    const historyMap = new Map();
    for (const record of history) {
      if (record.questionId) {
        historyMap.set(record.questionId.toString(), record);
      }
      if (record.questionText) {
        historyMap.set(record.questionText.trim().toLowerCase(), record);
      }
    }
    return historyMap;
  } catch (err) {
    console.warn("[QuestionHistory] Error fetching user question history:", err.message);
    return new Map();
  }
}

/**
 * Smart question selection with per-user history
 * Priority 1: Never asked questions (randomly shuffled)
 * Priority 2: Least recently asked (oldest askedAt), then least frequently asked (lowest timesAsked)
 */
async function selectQuestionsWithHistory(
  userId,
  candidateQuestions,
  count,
  tags = [],
  sessionId = null
) {
  if (!candidateQuestions || candidateQuestions.length === 0) return [];

  // Fetch complete question history for this user
  const historyMap = await getUserQuestionHistory(userId, tags);

  // Partition candidate pool into unseen vs seen questions
  const unseenQuestions = [];
  const seenQuestions = [];

  for (const q of candidateQuestions) {
    const qId = q._id ? q._id.toString() : q.questionId;
    const qText = (q.questionText || "").trim().toLowerCase();

    let matchedHistory = null;
    if (qId && historyMap.has(qId)) {
      matchedHistory = historyMap.get(qId);
    } else if (qText && historyMap.has(qText)) {
      matchedHistory = historyMap.get(qText);
    }

    if (matchedHistory) {
      seenQuestions.push({ question: q, history: matchedHistory });
    } else {
      unseenQuestions.push(q);
    }
  }

  // Shuffle unseen questions for high variety
  const shuffledUnseen = [...unseenQuestions].sort(() => 0.5 - Math.random());

  // Priority 1: If we have enough unseen questions, return them immediately
  if (shuffledUnseen.length >= count) {
    return shuffledUnseen.slice(0, count).map((q) => ({
      ...q,
      isNew: true,
    }));
  }

  // Priority 2: Exhaust unseen questions, then fill remaining slots with seen questions sorted by least recently asked
  const selected = shuffledUnseen.map((q) => ({ ...q, isNew: true }));
  const remainingSlots = count - selected.length;

  if (remainingSlots > 0 && seenQuestions.length > 0) {
    seenQuestions.sort((a, b) => {
      // 1. Least recently asked first (oldest askedAt date)
      const aTime = a.history?.askedAt ? new Date(a.history.askedAt).getTime() : 0;
      const bTime = b.history?.askedAt ? new Date(b.history.askedAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;

      // 2. Least frequently asked first
      const aTimes = a.history?.timesAsked || 1;
      const bTimes = b.history?.timesAsked || 1;
      return aTimes - bTimes;
    });

    for (let i = 0; i < remainingSlots && i < seenQuestions.length; i++) {
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
  if (!questions || !Array.isArray(questions) || questions.length === 0) return;

  const bulkOps = questions
    .map((q) => {
      const qId = q._id ? q._id.toString() : (q.questionId || q.questionText?.trim().slice(0, 60));
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
    try {
      await QuestionHistory.bulkWrite(bulkOps, { ordered: false });
      console.log(`[QuestionHistory] Recorded ${bulkOps.length} questions for User ${userId}`);
    } catch (err) {
      console.warn("[QuestionHistory] Error recording history:", err.message);
    }
  }
}

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

        const nlpData = nlpRes.data?.data || nlpRes.data?.questions || nlpRes.data || {};
        const domainTags = nlpData.domainTags || [];
        const resumeProjects = nlpData.projects || [];
        let projectQuestions = (nlpData.questions || []).filter((q) => q.track === "project");

        // Target at least 2 project questions for resume defense
        const targetProjectCount = Math.max(2, Math.min(resumeProjects.length > 0 ? (count >= 5 ? 3 : 2) : 0, count - 2));

        // Track 3: Prefer LLM-generated project questions grounded in the resume projects
        if (resumeProjects.length > 0 || session.resumeText) {
          try {
            const llmProjectQuestions = await generateProjectQuestions(
              resumeProjects,
              role,
              targetProjectCount,
              {
                sessionId: session._id.toString(),
                sessionIndex: 0,
                previousQuestions: [],
                resumeText: session.resumeText || null,
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

        // Track 1: Introduce Yourself / Opening Question (Always Question 1)
        const sessionEntropy = session._id.toString().split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const introQuestion = getIntroductoryQuestion(sessionEntropy);
        assembledQuestions.push({
          questionText: introQuestion.questionText,
          track: "hr",
          expectedKeywords: introQuestion.expectedKeywords || [],
          expectedConcepts: introQuestion.expectedConcepts || [],
          referenceAnswer: introQuestion.referenceAnswer || "",
        });

        // Track 2: Insert Project Questions UP FRONT (Questions 2 & 3)
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
        }

        // Track 3: Core Subject Questions matching Resume Skills (from DB)
        const remainingNeeded = Math.max(0, count - assembledQuestions.length);
        if (remainingNeeded > 0) {
          let subjectQuery = {
            $or: [{ college: null }, { college: { $exists: false } }],
          };
          if (domainTags.length > 0) {
            subjectQuery.tags = { $in: domainTags };
          } else {
            subjectQuery.tags = { $in: ["os", "dbms", "oop", "networking", "ds"] };
          }

          const subjectDbQuestions = await Question.find(subjectQuery).lean();
          if (subjectDbQuestions.length > 0) {
            const selectedSubjects = await selectQuestionsWithHistory(
              req.user._id,
              subjectDbQuestions,
              remainingNeeded,
              domainTags.length > 0 ? domainTags : ["os", "dbms", "oop", "networking", "ds"],
              session._id
            );
            for (const s of selectedSubjects) {
              assembledQuestions.push({
                questionText: s.questionText,
                track: "subject",
                expectedKeywords: s.keywords || s.expectedKeywords || [],
                expectedConcepts: s.expectedConcepts || [],
                referenceAnswer: s.referenceAnswer || "",
              });
            }
          }
        }

        // Deterministic question IDs keyed by session ID and index
        const answers = assembledQuestions.slice(0, count).map((q, idx) => ({
          questionId: `resume-q-${session._id}-${idx}`,
          questionText: q.questionText,
          track: q.track || "subject",
          dimension: q.dimension || null,
          expectedKeywords: q.expectedKeywords || [],
          expectedConcepts: q.expectedConcepts || [],
          referenceAnswer: q.referenceAnswer || "",
          projectContext: q.projectContext || null,
        }));

        // Atomic claim: write the assembled set ONLY if answers are still empty.
        // If another concurrent request (React StrictMode double-mount, double
        // click) already claimed the session, return THEIR set so the frontend
        // and the database always converge on a single question assembly.
        const claimed = await Session.findOneAndUpdate(
          {
            _id: session._id,
            $or: [{ answers: { $size: 0 } }, { answers: { $exists: false } }],
          },
          { $set: { answers } },
          { new: true }
        );

        if (!claimed) {
          const winnersSession = await Session.findById(session._id);
          console.log(`[ResumeEngine] Concurrent generation lost the race for Session ${session._id}; returning the stored question set.`);
          return sendSuccess(res, { session: winnersSession, questions: winnersSession.answers }, 200);
        }

        // Record question history for genuinely delivered resume questions
        await recordQuestionHistory(req.user._id, answers, session._id);

        console.log(`[ResumeEngine] Assembled and recorded ${answers.length} multi-track questions for Session ${session._id}`);
        return sendSuccess(res, { session: claimed, questions: claimed.answers }, 201);
      } catch (resumeErr) {
        console.warn("[QuestionEngine] Resume question synthesis error, falling back:", resumeErr.message);
      }
    }

    // ── Standard Technical & HR Interview Modes (Database Default Questions) ──
    // Subject of Interest: for technical sessions where the candidate picked
    // subjects, restrict the pool to those subjects instead of role-derived topics.
    const selectedSubjects =
      type === "technical" && Array.isArray(session.subjectsOfInterest)
        ? SUBJECT_TAGS.filter((t) => session.subjectsOfInterest.includes(t))
        : [];

    const searchTags = type === "hr"
      ? ["hr", "behavioral"]
      : selectedSubjects.length > 0
        ? [...selectedSubjects, "technical"]
        : [...getTopicsForRole(role), "technical"];

    const neededSubQuestions = Math.max(0, count - 1);
    let selectedPool = [];

    // Select from MongoDB Question Bank with Question History Prioritization
    let adminCustomQuestions = [];
    let defaultDbQuestions = [];

    try {
      const customQuery = {};
      if (userCollege) {
        customQuery.college = userCollege;
        customQuery.tags = { $in: searchTags };
        adminCustomQuestions = await Question.find(customQuery).lean();
      }

      const defaultQuery = {
        $or: [{ college: null }, { college: { $exists: false } }],
        tags: { $in: searchTags },
      };
      defaultDbQuestions = await Question.find(defaultQuery).lean();
    } catch (dbErr) {
      console.warn("MongoDB question query fallback:", dbErr.message);
    }

    if (adminCustomQuestions && adminCustomQuestions.length > 0) {
      selectedPool = adminCustomQuestions.map((q) => ({
        questionText: q.questionText,
        track: q.track || (type === "hr" ? "hr" : "subject"),
        expectedKeywords: q.keywords || [],
        expectedConcepts: q.expectedConcepts || [],
        referenceAnswer: q.referenceAnswer || "",
        isCustom: true,
        _id: q._id,
        tags: q.tags || [],
        track: q.track,
      }));
    }

    if (selectedPool.length < neededSubQuestions && defaultDbQuestions.length > 0) {
      const defaultPool = defaultDbQuestions.map((q) => ({
        questionText: q.questionText,
        track: q.track || (type === "hr" ? "hr" : "subject"),
        expectedKeywords: q.keywords || [],
        expectedConcepts: q.expectedConcepts || [],
        referenceAnswer: q.referenceAnswer || "",
        isCustom: false,
        _id: q._id,
        tags: q.tags || [],
        track: q.track,
      }));

      const needed = neededSubQuestions - selectedPool.length;
      const smartSelected = selectedSubjects.length > 0
        ? await selectDistributedQuestions(
            req.user._id,
            defaultPool,
            selectedSubjects,
            needed,
            session._id
          )
        : await selectQuestionsWithHistory(
            req.user._id,
            defaultPool,
            needed,
            searchTags,
            session._id
          );

      selectedPool = [...selectedPool, ...smartSelected];
    }

    if (selectedPool.length === 0) {
      let fallbackTextList = [];
      if (type === "hr") {
        fallbackTextList = HR_QUESTIONS;
      } else {
        const topics = selectedSubjects.length > 0
          ? selectedSubjects
          : getTopicsForRole(role);
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

    // Always reserve Question 1 for Introduce Yourself / Opening Question
    const sessionEntropy = session._id.toString().split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const introQuestion = getIntroductoryQuestion(sessionEntropy);

    const finalSelected = selectedPool.slice(0, neededSubQuestions);

    const answers = [
      {
        questionId: `q-${session._id}-0`,
        questionText: introQuestion.questionText,
        track: "hr",
        expectedKeywords: introQuestion.expectedKeywords || [],
        expectedConcepts: introQuestion.expectedConcepts || [],
        referenceAnswer: introQuestion.referenceAnswer || "",
        isNew: true,
      },
      ...finalSelected.map((q, index) => ({
        questionId: `q-${session._id}-${index + 1}`,
        questionText: q.questionText,
        track: q.track || (type === "hr" ? "hr" : "subject"),
        expectedKeywords: q.expectedKeywords || [],
        expectedConcepts: q.expectedConcepts || [],
        referenceAnswer: q.referenceAnswer || "",
        isNew: q.isNew || false,
      }))
    ];

    // Atomic claim (see resume path above): losers return the winner's set so
    // frontend and database always share one question assembly.
    const claimed = await Session.findOneAndUpdate(
      {
        _id: session._id,
        $or: [{ answers: { $size: 0 } }, { answers: { $exists: false } }],
      },
      { $set: { answers } },
      { new: true }
    );

    if (!claimed) {
      const winnersSession = await Session.findById(session._id);
      console.log(`[QuestionEngine] Concurrent generation lost the race for Session ${session._id}; returning the stored question set.`);
      return sendSuccess(res, { session: winnersSession, questions: winnersSession.answers }, 200);
    }

    // Record question history only for the delivered (winning) set
    await recordQuestionHistory(req.user._id, finalSelected, session._id);

    return sendSuccess(res, { session: claimed, questions: claimed.answers }, 201);
  } catch (err) {
    console.error("ERROR IN GENERATE QUESTIONS:", err);
    return sendError(res, err.message, 500);
  }
};

export default { generateQuestions };