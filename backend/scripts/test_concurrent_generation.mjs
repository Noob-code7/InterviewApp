/**
 * Concurrent-generation race test — executes the REAL generateQuestions controller
 * twice simultaneously against a fresh resume session (simulates React StrictMode
 * double-mount). Asserts frontend/DB convergence after Fix 1 (atomic claim).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/interviewapp");

const { default: Session } = await import("../models/Session.js");
const { default: User } = await import("../models/User.js");
const { default: QuestionHistory } = await import("../models/QuestionHistory.js");
const { generateQuestions } = await import("../controllers/questionController.js");

function mockRes(label) {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; console.log(`  [${label}] responded ${this.statusCode}`); return this; },
  };
}

async function main() {
  const user = await User.findOne({}).lean();
  if (!user) throw new Error("no user in DB");
  console.log(`using user ${user._id}`);

  for (const track of ["resume", "mixed"]) {
    const sessionId = new mongoose.Types.ObjectId();
    await Session.create({
      _id: sessionId,
      userId: user._id,
      interviewType: track,
      role: "Fullstack Systems Engineer",
      questionCount: 5,
      answers: [],
      resumeText: track === "resume"
        ? "Built an AI interview platform with React, Node.js, MongoDB, WebRTC real-time analysis, and Python microservices for NLP and emotion detection."
        : undefined,
      status: "setup",
    });

    console.log(`\n===== ${track.toUpperCase()} track: firing two concurrent generations =====`);
    const t0 = Date.now();
    const [resA, resB] = await Promise.allSettled([
      generateQuestions({ params: { sessionId: sessionId.toString() }, user: { _id: user._id, college: null }, body: {} }, mockRes("A")),
      generateQuestions({ params: { sessionId: sessionId.toString() }, user: { _id: user._id, college: null }, body: {} }, mockRes("B")),
    ]);
    console.log(`elapsed: ${Date.now() - t0}ms`);

    const getQs = (r) => {
      if (r.status !== "fulfilled") return null;
      const qs = r.value?.body?.data?.questions;
      return Array.isArray(qs) ? qs.map((q) => q.questionText) : null;
    };
    const qA = getQs(resA);
    const qB = getQs(resB);
    const codes = [resA, resB].map((r) => r.value?.body ? r.value.statusCode : `rejected:${r.reason?.message?.slice(0, 60)}`);
    console.log("response codes:", JSON.stringify(codes));

    const fresh = await Session.findById(sessionId).lean();
    const dbQs = (fresh.answers || []).map((a) => a.questionText);

    let ok = true;
    if (!qA || !qB) { console.log("FAIL: a response was rejected"); ok = false; }
    else {
      const sameAB = JSON.stringify(qA) === JSON.stringify(qB);
      console.log(`A===B: ${sameAB}`);
      console.log(`A===DB: ${JSON.stringify(qA) === JSON.stringify(dbQs)}`);
      console.log(`B===DB: ${JSON.stringify(qB) === JSON.stringify(dbQs)}`);
      if (!sameAB || JSON.stringify(qA) !== JSON.stringify(dbQs)) ok = false;
      // Show divergence sample
      for (let i = 0; i < Math.max(qA.length, qB.length); i++) {
        if (qA[i] !== qB[i]) console.log(`  Q${i + 1} DIVERGED:\n    A: ${qA[i]?.slice(0, 70)}\n    B: ${qB[i]?.slice(0, 70)}`);
      }
    }
    console.log(ok ? `>>> ${track}: PASS — single converged assembly\n` : `>>> ${track}: FAIL\n`);
    await Session.deleteOne({ _id: sessionId });
    await QuestionHistory.deleteMany({ sessionId });
  }
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error("TEST ERROR:", e.message); process.exit(1); });
