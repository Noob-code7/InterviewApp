/**
 * Curated conversational phrasing banks and intent patterns for continuous AI interview flow.
 */

export const INTERVIEW_GREETINGS = [
  "Hello! Welcome to your interview today. How are you doing?",
  "Hi there! It's great to have you here today. Ready to get started?",
  "Welcome! Thank you for taking the time to meet with me today. How are you feeling?",
  "Hello! Glad you could make it to the interview session today. Are you ready to begin?",
  "Hi! Welcome to InterviewAI. Hope you're having a great day so far. Ready to dive in?",
  "Hello and welcome! It's a pleasure to speak with you today. How's everything going?",
  "Hi! Welcome to your technical assessment. Ready to get started with the first question?",
  "Hello there! Welcome to the interview. I'm excited to learn more about your experience today. Ready?",
  "Hi! Great to connect with you today. How are you doing?",
  "Welcome to the interview session! I hope you're feeling good and ready to get started."
];

export const GREETING_ACKNOWLEDGEMENTS = [
  "Awesome! Let's dive right into your first question.",
  "Great to hear! Let's get started with Question 1.",
  "Wonderful! Let's jump into the first question.",
  "Excellent! Let's begin the interview.",
  "Glad to hear that. Let's move into your first question."
];

export const QUESTION_TRANSITIONS = [
  "Got it. Let's move on to the next question.",
  "Alright, thanks for explaining that. Let's talk about another area.",
  "Great. Let's continue with the next question.",
  "Understood. Moving on to the next topic.",
  "Thank you. Let's look at the next question."
];

export const CLOSING_STATEMENTS = [
  "Thank you so much! That wraps up our interview today. I will now compile your comprehensive assessment report.",
  "Great job, we have reached the end of the interview. Thank you for your time and thoughtful responses.",
  "That concludes the interview session today. Thank you for participating! Compiling your report now."
];

export const INTERRUPTION_INTENTS = {
  ACKNOWLEDGEMENT: "ACKNOWLEDGEMENT",
  ANSWER: "ANSWER",
  GENERAL_INTERRUPTION: "GENERAL_INTERRUPTION",
  UNKNOWN: "UNKNOWN",
};

/**
 * Lightweight local pattern matching for candidate interruption intent classification.
 */
export function classifyInterruption(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return INTERRUPTION_INTENTS.UNKNOWN;
  }

  const text = rawText.trim().toLowerCase().replace(/[^a-z0-9\s?\']/g, "");

  if (!text) return INTERRUPTION_INTENTS.UNKNOWN;

  // 1. GENERAL INTERRUPTION / PAUSE REQUESTS
  const pausePatterns = [
    /\b(wait a second|hold on|give me a moment|give me a second|one second|just a moment|just a second|wait a moment|let me think)\b/,
    /^wait$/,
    /^hold on$/
  ];
  for (const p of pausePatterns) {
    if (p.test(text)) return INTERRUPTION_INTENTS.GENERAL_INTERRUPTION;
  }

  // 2. SHORT ACKNOWLEDGEMENT PATTERNS (< 5 words)
  const ackPatterns = [
    /^(okay|ok|got it|understood|sure|yes|yeah|alright|right|yep|yup|i see|makes sense)$/,
    /^(okay got it|yeah sure|alright got it|okay understood)$/
  ];
  for (const p of ackPatterns) {
    if (p.test(text)) return INTERRUPTION_INTENTS.ACKNOWLEDGEMENT;
  }

  // 3. DIRECT ANSWER PATTERNS
  const answerStartPatterns = [
    /\b(we used|i used|we implemented|i implemented|the reason is|in my project|in our architecture|because|we built|i built|we chose|i chose|the architecture is|we resolved|i resolved|to solve this|we designed|i designed)\b/,
    /\b(redis|mongodb|postgresql|react|docker|kubernetes|node|microservices|transcoding|database|indexing|caching)\b/
  ];
  for (const p of answerStartPatterns) {
    if (p.test(text)) return INTERRUPTION_INTENTS.ANSWER;
  }

  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 5) {
    return INTERRUPTION_INTENTS.ANSWER;
  }

  return INTERRUPTION_INTENTS.UNKNOWN;
}

export function getRandomItem(array, seed = null) {
  if (!array || array.length === 0) return "";
  if (seed !== null && typeof seed === "number") {
    const idx = Math.abs(seed) % array.length;
    return array[idx];
  }
  const idx = Math.floor(Math.random() * array.length);
  return array[idx];
}