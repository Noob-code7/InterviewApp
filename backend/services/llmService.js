import axios from "axios";

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";

/**
 * Generate deep technical questions strictly grounded in candidate projects.
 */
export const generateProjectQuestions = async (
  projects,
  role = "Software Engineer",
  count = 2,
  options = {}
) => {
  try {
    const response = await axios.post(
      `${NLP_SERVICE_URL}/generate-project-questions`,
      {
        projects,
        role,
        count,
        sessionId: options.sessionId || null,
        sessionIndex: options.sessionIndex || 0,
        previousQuestions: options.previousQuestions || [],
      },
      { timeout: 30000 }
    );
    return response.data?.data?.questions || [];
  } catch (err) {
    console.warn("[LLMService] Error generating project questions, using fallback:", err.message);
    return projects.slice(0, count).map((p) => ({
      questionText: `In your project '${p.title}', walk me through the end-to-end architecture, data flow, and how you engineered the core features.`,
      track: "project",
      dimension: "architecture",
      expectedConcepts: [`Architecture of ${p.title}`, "Data flow", "Component interactions"],
      keywords: (p.techStack || []).map((s) => s.toLowerCase()),
      projectContext: p,
    }));
  }
};

/**
 * Generate a dynamic contextual follow-up question (max 2 follow-ups) drilling into candidate's project answer.
 */
export const generateProjectFollowUp = async (
  projectContext,
  question,
  answer,
  previousFollowUps = [],
  turnCount = 1
) => {
  try {
    if (turnCount > 2 || !answer || answer.trim().split(/\s+/).length < 4) {
      return null;
    }

    const response = await axios.post(
      `${NLP_SERVICE_URL}/generate-project-followup`,
      {
        projectContext: projectContext || {},
        question,
        answer,
        previousFollowUps,
        turnCount,
      },
      { timeout: 20000 }
    );
    return response.data?.data || null;
  } catch (err) {
    console.warn("[LLMService] Error generating project follow-up:", err.message);
    return null;
  }
};

/**
 * Evaluate candidate's verbal response to a project question or project follow-up question.
 */
export const evaluateProjectAnswer = async (
  projectContext,
  question,
  answer,
  isFollowUp = false
) => {
  try {
    const response = await axios.post(
      `${NLP_SERVICE_URL}/evaluate-project-answer`,
      {
        projectContext: projectContext || {},
        question,
        answer,
        isFollowUp,
      },
      { timeout: 30000 }
    );
    return response.data?.data || null;
  } catch (err) {
    console.warn("[LLMService] Error evaluating project answer with LLM:", err.message);
    return null;
  }
};

export default {
  generateProjectQuestions,
  generateProjectFollowUp,
  evaluateProjectAnswer,
};
