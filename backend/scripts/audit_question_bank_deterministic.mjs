import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load comprehensiveQuestionBank.json
const compBankPath = path.resolve(__dirname, "../data/comprehensiveQuestionBank.json");
const compBank = JSON.parse(fs.readFileSync(compBankPath, "utf8"));

// 2. Load questionBanks.js
const {
  TECHNICAL_QUESTION_BANK,
  HR_QUESTIONS,
  INTRODUCTORY_QUESTIONS,
} = await import("../data/questionBanks.js");

// 3. Load seedQuestions.js
// Extract SEED_QUESTIONS by parsing or importing
const seedQuestionsFile = fs.readFileSync(path.resolve(__dirname, "./seedQuestions.js"), "utf8");

// Deduplicate questions by normalized questionText
const allQuestionsMap = new Map();

function addQuestion(q, source) {
  if (!q || !q.questionText) return;
  const normalizedText = q.questionText.trim().toLowerCase().replace(/\s+/g, " ");
  if (!allQuestionsMap.has(normalizedText)) {
    allQuestionsMap.set(normalizedText, {
      ...q,
      questionText: q.questionText.trim(),
      sources: [source],
    });
  } else {
    const existing = allQuestionsMap.get(normalizedText);
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
    // Merge metadata if richer
    if ((!existing.referenceAnswer || existing.referenceAnswer.length < 20) && q.referenceAnswer) {
      existing.referenceAnswer = q.referenceAnswer;
    }
    if ((!existing.keywords || existing.keywords.length === 0) && q.keywords) {
      existing.keywords = q.keywords;
    }
  }
}

// Ingest from comprehensiveQuestionBank
compBank.forEach((q) => addQuestion(q, "comprehensiveQuestionBank.json"));

// Ingest from questionBanks.js
Object.entries(TECHNICAL_QUESTION_BANK).forEach(([category, list]) => {
  list.forEach((qText) => addQuestion({ questionText: qText, tags: [category, "technical"] }, "questionBanks.js (TECHNICAL_QUESTION_BANK)"));
});
HR_QUESTIONS.forEach((qText) => addQuestion({ questionText: qText, track: "hr", tags: ["hr"] }, "questionBanks.js (HR_QUESTIONS)"));
INTRODUCTORY_QUESTIONS.forEach((q) => addQuestion({ ...q, track: "warmup" }, "questionBanks.js (INTRODUCTORY_QUESTIONS)"));

const totalQuestions = Array.from(allQuestionsMap.values());
console.log(`\n================================================================`);
console.log(`📊 TOTAL UNIQUE QUESTIONS INGESTED: ${totalQuestions.length}`);
console.log(`================================================================\n`);

// Classification Rules & Ambiguity Detection
const classified = {
  binary: [],
  single_answer: [],
  short_answer: [],
  multiple_choice_style: [],
  explanatory: [],
  ambiguous_review: [],
};

for (const q of totalQuestions) {
  const qText = q.questionText.trim();
  const qLower = qText.toLowerCase();
  const ref = (q.referenceAnswer || "").trim();
  const refLower = ref.toLowerCase();

  // Check if compound / explanatory question with "why", "how", "explain", "describe", "compare", "difference", "what are", "advantages"
  const hasReasoningDirective = /\b(why|how|explain|describe|compare|difference|advantages|disadvantages|pros and cons|work internally|what are different|what are various)\b/i.test(qLower);
  const isCompoundQuestion = /\?.*[a-z0-9]/i.test(qText) || /(&|and\s+why|and\s+how|and\s+explain)/i.test(qLower);

  // ── 1. Binary Analysis ──────────────────────────────────────────────────────────
  const isBinaryStarter = /^(can (you|we)|is (it|there|a|an)|does (a|an|the|java)|do you think|are there|will)\b/i.test(qText);

  if (isBinaryStarter) {
    // Check if it asks for explanation / reasoning
    if (hasReasoningDirective || isCompoundQuestion) {
      // E.g. "Do you think BCNF is better than 2NF & 3NF? Why?"
      classified.ambiguous_review.push({
        question: qText,
        reason: "Starts with binary phrasing but includes 'Why?' or compound reasoning requirement.",
        recommendedCategory: "explanatory",
        sources: q.sources,
      });
      classified.explanatory.push({ ...q, answerType: "explanatory" });
      continue;
    }

    // Pure binary questions:
    if (/can (you|we|a developer) write multiple catch blocks/i.test(qLower)) {
      classified.binary.push({
        question: qText,
        answerType: "binary",
        canonicalAnswer: "Yes",
        acceptedAnswers: [
          "yes",
          "true",
          "we can",
          "yes we can",
          "yes you can",
          "yes it is possible",
          "it is possible",
          "multiple catch blocks are allowed",
        ],
        verificationNote: "Java allows multiple catch blocks under a single try block. Deterministic Yes.",
        sources: q.sources,
      });
      continue;
    }

    if (/can (you|we) override a (private|static) method/i.test(qLower)) {
      classified.binary.push({
        question: qText,
        answerType: "binary",
        canonicalAnswer: "No",
        acceptedAnswers: [
          "no",
          "false",
          "we cannot",
          "you cannot",
          "cannot override",
          "no we cannot",
          "no you cannot",
          "not possible",
          "it is not possible",
        ],
        verificationNote: "In Java, private and static methods cannot be overridden (static methods are hidden, private methods are not inherited). Deterministic No.",
        sources: q.sources,
      });
      continue;
    }

    // Any other binary question without explicit accepted answers should be flagged
    classified.ambiguous_review.push({
      question: qText,
      reason: "Starts with binary verb but lacks deterministic accepted answers in trusted bank.",
      recommendedCategory: "explanatory",
      sources: q.sources,
    });
    classified.explanatory.push({ ...q, answerType: "explanatory" });
    continue;
  }

  // ── 2. Single Answer & Short Answer Analysis ──────────────────────────────────
  // Process Definition
  if (/what is a program in execution/i.test(qLower)) {
    classified.single_answer.push({
      question: qText,
      answerType: "single_answer",
      canonicalAnswer: "A process",
      acceptedAnswers: [
        "process",
        "a process",
        "it is a process",
        "a process in execution",
        "process is a program in execution",
      ],
      verificationNote: "Standard operating system definition: A process is an instance of a program in execution. Deterministic.",
      sources: q.sources,
    });
    continue;
  }

  // Normal form adequacy
  if (/which normal form is considered adequate for relational database design/i.test(qLower)) {
    classified.short_answer.push({
      question: qText,
      answerType: "short_answer",
      canonicalAnswer: "3NF or BCNF",
      acceptedAnswers: [
        "3nf",
        "third normal form",
        "bcnf",
        "boyce-codd normal form",
        "boyce codd normal form",
        "3rd normal form",
      ],
      verificationNote: "In relational database theory and textbooks, 3NF (or BCNF) is considered adequate for most practical database designs. Deterministic short answer.",
      sources: q.sources,
    });
    continue;
  }

  // Check FCFS Expansion
  if (/what do you mean by fcfs/i.test(qLower) && !hasReasoningDirective) {
    classified.short_answer.push({
      question: qText,
      answerType: "short_answer",
      canonicalAnswer: "First-Come, First-Served",
      acceptedAnswers: [
        "first come first serve",
        "first come first served",
        "fcfs stands for first come first served",
        "first-come, first-served",
      ],
      verificationNote: "FCFS scheduling algorithm standard definition. Deterministic.",
      sources: q.sources,
    });
    continue;
  }

  // Default: Explanatory
  classified.explanatory.push({ ...q, answerType: "explanatory" });
}

console.log("================================================================");
console.log("📋 PROGRAMMATIC AUDIT CLASSIFICATION RESULTS");
console.log("================================================================");
console.log(`Total Questions Scanned:         ${totalQuestions.length}`);
console.log(`  • binary:                      ${classified.binary.length}`);
console.log(`  • single_answer:               ${classified.single_answer.length}`);
console.log(`  • short_answer:                ${classified.short_answer.length}`);
console.log(`  • multiple_choice_style:       ${classified.multiple_choice_style.length}`);
console.log(`  • explanatory:                 ${classified.explanatory.length}`);
console.log(`  • flagged for review:          ${classified.ambiguous_review.length}`);
console.log("================================================================\n");

console.log("🔍 DETAILED LIST OF NON-EXPLANATORY CLASSIFICATIONS:\n");

console.log("─── 1. BINARY QUESTIONS ───");
classified.binary.forEach((item, idx) => {
  console.log(`[B-${idx + 1}] Question: "${item.question}"`);
  console.log(`      Answer Type:        ${item.answerType}`);
  console.log(`      Canonical Answer:   ${item.canonicalAnswer}`);
  console.log(`      Accepted Answers:   ${JSON.stringify(item.acceptedAnswers)}`);
  console.log(`      Verification Note:  ${item.verificationNote}`);
  console.log(`      Sources:            ${item.sources.join(", ")}\n`);
});

console.log("─── 2. SINGLE ANSWER QUESTIONS ───");
classified.single_answer.forEach((item, idx) => {
  console.log(`[SA-${idx + 1}] Question: "${item.question}"`);
  console.log(`       Answer Type:        ${item.answerType}`);
  console.log(`       Canonical Answer:   ${item.canonicalAnswer}`);
  console.log(`       Accepted Answers:   ${JSON.stringify(item.acceptedAnswers)}`);
  console.log(`       Verification Note:  ${item.verificationNote}`);
  console.log(`       Sources:            ${item.sources.join(", ")}\n`);
});

console.log("─── 3. SHORT ANSWER QUESTIONS ───");
classified.short_answer.forEach((item, idx) => {
  console.log(`[SHA-${idx + 1}] Question: "${item.question}"`);
  console.log(`        Answer Type:        ${item.answerType}`);
  console.log(`        Canonical Answer:   ${item.canonicalAnswer}`);
  console.log(`        Accepted Answers:   ${JSON.stringify(item.acceptedAnswers)}`);
  console.log(`        Verification Note:  ${item.verificationNote}`);
  console.log(`        Sources:            ${item.sources.join(", ")}\n`);
});

console.log("─── 4. AMBIGUOUS / COMPOUND QUESTIONS FLAGGED FOR REVIEW (KEPT AS EXPLANATORY) ───");
classified.ambiguous_review.forEach((item, idx) => {
  console.log(`[REV-${idx + 1}] Question: "${item.question}"`);
  console.log(`        Reason:               ${item.reason}`);
  console.log(`        Recommended Category: ${item.recommendedCategory}`);
  console.log(`        Sources:              ${item.sources.join(", ")}\n`);
});
