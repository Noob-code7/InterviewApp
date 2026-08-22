import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import FormData from "form-data";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { signAccessToken } from "../utils/jwt.js";

const API_BASE = "http://localhost:5000/api";

async function runBargeInTest() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/interviewapp");

  let user = await User.findOne();
  if (!user) {
    user = await User.create({
      name: "BargeIn Test User",
      email: `bargein_${Date.now()}@test.com`,
      password: "Password123!",
      role: "candidate",
    });
  }

  const token = signAccessToken(user._id);
  const headers = { Authorization: `Bearer ${token}` };

  console.log("================================================================");
  console.log("🧪 TESTING BARGE-IN INTERRUPTION RECOVERY FLOW (E2E)");
  console.log("================================================================\n");

  // Step 1: Create Session
  const createRes = await axios.post(
    `${API_BASE}/sessions`,
    {
      role: "Operating Systems Engineer",
      interviewType: "technical",
      questionCount: 2,
      candidateName: "Barge-In Candidate",
    },
    { headers }
  );
  const session = createRes.data.data.session;
  const sessionId = session._id;
  console.log(`1. Session created: ${sessionId}`);

  // Step 2: Generate Questions
  const qRes = await axios.post(
    `${API_BASE}/sessions/${sessionId}/questions`,
    { count: 2 },
    { headers }
  );
  const questions = qRes.data.data.questions || qRes.data.data.session.answers;
  console.log(`2. Generated ${questions.length} questions:`);
  console.log(`   Q1: "${questions[0].questionText}"`);
  console.log(`   Q2: "${questions[1].questionText}"\n`);

  const q1 = questions[0];
  const q2 = questions[1];

  // Step 3: Candidate answers Question 1 (Attempt 1 - partial answer)
  const q1_partial = "OS is an operating...";
  console.log(`3. Candidate answers Question 1 (Attempt 1): "${q1_partial}"`);
  
  // Upload Video for Q1 Attempt 1
  await axios.post(
    `${API_BASE}/sessions/${sessionId}/answers/${q1.questionId}`,
    {
      videoUrl: `/uploads/test-answer-${sessionId}-0-att1.webm`,
      questionIndex: 0,
      questionText: q1.questionText,
    },
    { headers }
  );

  // Transcribe Q1 Attempt 1
  const form1 = new FormData();
  form1.append("audio", Buffer.from("RIFF_audio_chunk_1"), {
    filename: "answer1.webm",
    contentType: "audio/webm",
  });
  form1.append("sessionId", sessionId.toString());
  form1.append("questionId", q1.questionId);
  form1.append("questionIndex", "0");
  form1.append("questionText", q1.questionText);
  form1.append("clientTranscript", q1_partial);

  await axios.post(`${API_BASE}/analysis/voice`, form1, {
    headers: { ...headers, ...form1.getHeaders() },
  });

  // Verify DB after Attempt 1
  let sessionDb = await Session.findById(sessionId).lean();
  console.log(`   DB Q1 after Attempt 1: "${sessionDb.answers[0].transcript || sessionDb.answers[0].voiceAnalysis?.transcript}"`);

  // Step 4: System progresses toward Question 2, candidate BARGES IN on Question 2
  // and continues answering Question 1!
  const q1_continuation = "OS is also known as an operating system.";
  const q1_merged_expected = "OS is an operating... OS is also known as an operating system.";
  console.log(`\n4. Candidate BARGES IN during Question 2 to continue Question 1!`);
  console.log(`   Continuation speech: "${q1_continuation}"`);
  console.log(`   Expected merged Q1: "${q1_merged_expected}"`);

  // Upload Video for Q1 Attempt 2 (Continuation)
  await axios.post(
    `${API_BASE}/sessions/${sessionId}/answers/${q1.questionId}`,
    {
      videoUrl: `/uploads/test-answer-${sessionId}-0-att2.webm`,
      questionIndex: 0,
      questionText: q1.questionText,
      isContinuation: true,
    },
    { headers }
  );

  // Transcribe Q1 Attempt 2 (Continuation - passing merged client transcript)
  const form1_cont = new FormData();
  form1_cont.append("audio", Buffer.from("RIFF_audio_chunk_2"), {
    filename: "answer1_cont.webm",
    contentType: "audio/webm",
  });
  form1_cont.append("sessionId", sessionId.toString());
  form1_cont.append("questionId", q1.questionId);
  form1_cont.append("questionIndex", "0");
  form1_cont.append("questionText", q1.questionText);
  form1_cont.append("clientTranscript", q1_merged_expected);
  form1_cont.append("isContinuation", "true");

  await axios.post(`${API_BASE}/analysis/voice`, form1_cont, {
    headers: { ...headers, ...form1_cont.getHeaders() },
  });

  // Verify DB after Continuation
  sessionDb = await Session.findById(sessionId).lean();
  const q1_actual_transcript = sessionDb.answers[0].transcript || sessionDb.answers[0].voiceAnalysis?.transcript;
  console.log(`   DB Q1 after Continuation: "${q1_actual_transcript}"`);

  if (!q1_actual_transcript.includes("OS is an operating") || !q1_actual_transcript.includes("OS is also known")) {
    throw new Error(`FAIL: Question 1 transcript was NOT merged properly! Got: "${q1_actual_transcript}"`);
  }
  console.log(`   ✓ Question 1 transcript preserved both segments cleanly!`);

  // Step 5: Question 2 is re-delivered and candidate answers Question 2
  const q2_answer = "Virtual memory creates an illusion of large continuous memory space for applications.";
  console.log(`\n5. Candidate answers Question 2: "${q2_answer}"`);

  await axios.post(
    `${API_BASE}/sessions/${sessionId}/answers/${q2.questionId}`,
    {
      videoUrl: `/uploads/test-answer-${sessionId}-1.webm`,
      questionIndex: 1,
      questionText: q2.questionText,
    },
    { headers }
  );

  const form2 = new FormData();
  form2.append("audio", Buffer.from("RIFF_audio_q2"), {
    filename: "answer2.webm",
    contentType: "audio/webm",
  });
  form2.append("sessionId", sessionId.toString());
  form2.append("questionId", q2.questionId);
  form2.append("questionIndex", "1");
  form2.append("questionText", q2.questionText);
  form2.append("clientTranscript", q2_answer);

  await axios.post(`${API_BASE}/analysis/voice`, form2, {
    headers: { ...headers, ...form2.getHeaders() },
  });

  // Step 6: Finalize Session & Start Processing Pipeline
  console.log(`\n6. Starting background processing pipeline...`);
  await axios.patch(
    `${API_BASE}/sessions/${sessionId}/status`,
    { status: "processing" },
    { headers }
  );
  await axios.post(`${API_BASE}/analysis/${sessionId}/start`, {}, { headers });

  // Poll until analysis completes
  for (let attempt = 0; attempt < 25; attempt++) {
    const statusRes = await axios.get(`${API_BASE}/sessions/${sessionId}/status`, { headers });
    const currentStatus = statusRes.data.data?.session?.status;
    if (currentStatus === "completed") {
      console.log(`   Background processing completed (attempt ${attempt + 1}).`);
      break;
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  // Step 7: Fetch Final Assessment Report
  console.log(`7. Fetching final report for session ${sessionId}...`);
  const reportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
  const report = reportRes.data.data;
  const reportAnswers = report.answers || [];

  console.log(`   Report contains ${reportAnswers.length} answers.`);

  // Assertions
  if (reportAnswers.length !== 2) {
    throw new Error(`FAIL: Expected 2 answers in report, but found ${reportAnswers.length}!`);
  }

  const rQ1 = reportAnswers[0];
  const rQ2 = reportAnswers[1];

  const reportQ1Transcript = rQ1.voiceAnalysis?.transcript || rQ1.transcript || "";
  const reportQ2Transcript = rQ2.voiceAnalysis?.transcript || rQ2.transcript || "";

  console.log("\n===== FINAL REPORT VERIFICATION =====");
  console.log(`Question 1 Final Transcript in Report:`);
  console.log(`  "${reportQ1Transcript}"`);
  console.log(`Question 2 Final Transcript in Report:`);
  console.log(`  "${reportQ2Transcript}"`);

  if (reportQ1Transcript !== q1_merged_expected) {
    throw new Error(`FAIL: Report Q1 transcript mismatch!\n  Expected: "${q1_merged_expected}"\n  Actual:   "${reportQ1Transcript}"`);
  }
  console.log(`✓ Report Q1 Transcript matches the full merged answer!`);

  console.log("Report Q1 raw object:", JSON.stringify(rQ1, null, 2));

  if (!rQ1.nlpAnalysis || typeof rQ1.nlpAnalysis.overallScore !== "number") {
    throw new Error(`FAIL: Question 1 NLP analysis is missing! Got: ${JSON.stringify(rQ1.nlpAnalysis)}`);
  }
  console.log(`✓ Report Q1 NLP score: ${rQ1.nlpAnalysis.overallScore} (feedback: "${rQ1.nlpAnalysis.feedback}")`);

  if (reportQ2Transcript !== q2_answer) {
    throw new Error(`FAIL: Report Q2 transcript mismatch!\n  Expected: "${q2_answer}"\n  Actual:   "${reportQ2Transcript}"`);
  }
  console.log(`✓ Report Q2 Transcript is preserved independently!`);

  console.log("\n================================================================");
  console.log("🎉 BARGE-IN INTERRUPTION RECOVERY E2E TEST PASSED 100%!");
  console.log("================================================================\n");

  await mongoose.disconnect();
  return true;
}

runBargeInTest().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
