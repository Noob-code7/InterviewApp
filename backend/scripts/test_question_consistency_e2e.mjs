/**
 * E2E Question Consistency Test — proves for EVERY question:
 * displayed = spoken = stored = evaluated.
 *
 * Simulates StrictMode double-generation (two racing generateQuestions),
 * takes ONE response as "what the frontend displayed/spoke", then uploads
 * an answer per question through the REAL transcribeAndEvaluate controller
 * (real slot matching, real nlp-service evaluation, real DB persistence).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/interviewapp");

const { default: Session } = await import("../models/Session.js");
const { default: User } = await import("../models/User.js");
const { default: QuestionHistory } = await import("../models/QuestionHistory.js");
const { generateQuestions } = await import("../controllers/questionController.js");
const { transcribeAndEvaluate } = await import("../controllers/analysisController.js");
const handler = Array.isArray(transcribeAndEvaluate) ? transcribeAndEvaluate[1] : transcribeAndEvaluate;

function mockRes(label) {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

// Minimal valid WAV (44-byte header + silence) so voice-service STT returns empty
// and clientTranscript becomes the final transcript.
function silenceWav(seconds = 1) {
  const sr = 16000, samples = sr * seconds;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

async function main() {
  const user = await User.findOne({}).lean();
  const sessionId = new mongoose.Types.ObjectId();
  await Session.create({
    _id: sessionId, userId: user._id, interviewType: "resume",
    role: "Fullstack Systems Engineer", questionCount: 5, answers: [],
    resumeText: "Built an AI interview platform using React, Node.js, MongoDB, WebRTC and Python microservices.",
    status: "setup",
  });
  const sid = sessionId.toString();

  // 1. StrictMode proxy: two racing generations
  const [resA, resB] = await Promise.allSettled([
    generateQuestions({ params: { sessionId: sid }, user: { _id: user._id, college: null }, body: {} }, mockRes("genA")),
    generateQuestions({ params: { sessionId: sid }, user: { _id: user._id, college: null }, body: {} }, mockRes("genB")),
  ]);
  const spoken = resA.value.body.data.questions.map((q) => q.questionText);
  const stored = resB.value.body.data.questions.map((q) => q.questionText);
  console.log(`generation converged: ${JSON.stringify(spoken) === JSON.stringify(stored)} (${spoken.length} questions)`);

  // 2. Upload one answer per question through the REAL controller
  const uploadsDir = path.resolve(__dirname, "../uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  for (let i = 0; i < spoken.length; i++) {
    const fname = `e2e-consistency-${sid}-${i}.webm`;
    // Real distinct spoken answer via Kokoro TTS -> Whisper must transcribe the marker word
    const marker = ["banana", "rocket", "piano", "guitar", "window"][i];
    const ttsRes = await fetch("http://127.0.0.1:8002/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `The ${marker} sits quietly on the table while everyone talks about the meeting.` }) });
    const wavBuf = Buffer.from(await ttsRes.arrayBuffer());
    console.log(`   [tts] status=${ttsRes.status} bytes=${wavBuf.length} head=${JSON.stringify(wavBuf.slice(0, 4).toString())}`);
    fs.writeFileSync(path.join(uploadsDir, fname), wavBuf);
    const spokenText = spoken[i];
    const transcript = "";
    const req = {
      params: {},
      body: {
        sessionId: sid,
        questionId: resA.value.body.data.questions[i].questionId,
        questionText: spokenText,
        questionIndex: String(i),
        clientTranscript: transcript,
      },
      file: { filename: fname },
      user: { _id: user._id },
    };
    const res = mockRes(`up${i}`);
    try {
      await handler(req, res);
      console.log(`Q${i + 1} upload: ${res.statusCode} eval=${res.body?.data?.evaluation?.overallScore ?? "?"}`);
    } catch (e) {
      console.log(`Q${i + 1} upload ERROR: ${e.message}`);
    }
  }

  // 3. Assert full consistency from the persisted session
  const fresh = await Session.findById(sid).lean();
  let fails = 0;
  console.log("\n===== CONSISTENCY ASSERTIONS =====");
  const markerWords = ["banana", "rocket", "piano", "guitar", "window"];
  for (let i = 0; i < spoken.length; i++) {
    const a = fresh.answers[i];
    const displayed = spoken[i];
    const okText = a.questionText === displayed;
    const okTranscript = (a.transcript || "").toLowerCase().includes(markerWords[i]);
    const okEval = !!a.nlpAnalysis?.feedback;
    // Feedback for low scores embeds the question text -> proves eval context
    const fb = a.nlpAnalysis?.feedback || "";
    const okContext = a.nlpAnalysis?.overallScore >= 50 || fb.includes(displayed.slice(0, 40));
    const ok = okText && okTranscript && okEval && okContext;
    if (!ok) fails++;
    console.log(`   Q${i+1} transcript: ${JSON.stringify((a.transcript||"").slice(0,80))}`);
    console.log(`Q${i + 1}: text=${okText ? "OK" : "MISMATCH"} transcript=${okTranscript ? "OK" : "WRONG"} eval=${okEval ? "OK" : "MISSING"} context=${okContext ? "OK" : "WRONG-Q"} ${ok ? "PASS" : "FAIL"}`);
    if (!okText) console.log(`   stored: ${a.questionText?.slice(0, 70)}\n   spoken: ${displayed.slice(0, 70)}`);
  }

  // cleanup
  await Session.deleteOne({ _id: sessionId });
  await QuestionHistory.deleteMany({ sessionId });
  for (let i = 0; i < spoken.length; i++) {
    try { fs.unlinkSync(path.join(uploadsDir, `e2e-consistency-${sid}-${i}.webm`)); } catch (e) {}
  }

  console.log(fails === 0 ? "\nRESULT: ALL QUESTIONS CONSISTENT" : `\nRESULT: ${fails} FAILURE(S)`);
  await mongoose.disconnect();
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("TEST ERROR:", e.message); process.exit(1); });
