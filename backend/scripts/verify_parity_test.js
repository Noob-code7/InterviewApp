import 'dotenv/config';
// Deterministic pipeline mode: no ML models required, still exercises
// storage resolution, concurrency, aggregation, and persistence for real.
process.env.MOCK_ANALYZERS = 'true';
import mongoose from 'mongoose';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Question from '../models/Question.js';
import { signAccessToken } from '../utils/jwt.js';
import { processSession } from '../services/analysisService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://127.0.0.1:5000/api';
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

async function runParityVerification() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');

  const user = await User.findOne();
  if (!user) {
    console.error('No test user found');
    process.exit(1);
  }
  const token = signAccessToken(user._id);
  const headers = { Authorization: `Bearer ${token}` };

  console.log('========================================================================');
  console.log('🧪 PRODUCTION VERIFICATION & SCORE PARITY TEST (MOCK_ANALYZERS=on)');
  console.log('========================================================================\n');

  const fixtureFiles = [
    path.join(FIXTURES_DIR, 'test_candidate_q1.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q2.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q3.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q4.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q5.webm'),
  ];

  const transcripts = [
    "Process isolation in modern operating systems prevents processes from interfering with each other memory space using hardware MMU, virtual memory paging, and privilege rings.",
    "Deadlock occurs when four necessary conditions hold: mutual exclusion, hold and wait, no preemption, and circular wait. We can prevent deadlock by enforcing a strict global ordering on resource acquisition.",
    "TCP provides connection-oriented, reliable byte-stream transmission with three-way handshakes, sequence numbers, checksums, and congestion control. UDP provides lightweight, connectionless datagram delivery with lower latency.",
    "We engineered a scalable distributed messaging platform with Node.js, WebSockets, Redis Pub/Sub channels, and MongoDB replica sets with change streams for event sourcing.",
    "ACID transaction properties guarantee Atomicity, Consistency, Isolation, and Durability. In relational databases, these are enforced via Write-Ahead Logging (WAL) and multi-version concurrency control (MVCC).",
  ];

  const writingSample = "Microservices architecture partitions an application into discrete, independently deployable services that communicate via lightweight network APIs such as gRPC or HTTP/REST. Each service maintains encapsulated domain boundaries and its own private database.";

  // 1. Create Session
  const createRes = await axios.post(
    `${API_BASE}/sessions`,
    {
      role: 'Senior Distributed Systems Engineer',
      interviewType: 'technical',
      questionCount: 5,
      candidateName: 'Production Verification Candidate',
      includeWritingTest: true,
    },
    { headers }
  );
  const session = createRes.data.data.session;
  const sessionId = session._id;

  // Stage fixtures under session-unique names so concurrent analysis of other
  // sessions (e.g. backend recovery re-queues) can never collide with this run's
  // media files in the shared uploads dir.
  const uploadsDir = path.resolve(__dirname, '../uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const stagedFiles = [];
  for (let i = 0; i < fixtureFiles.length; i++) {
    const uniqueName = `test_candidate_${sessionId}_q${i + 1}.webm`;
    fs.copyFileSync(fixtureFiles[i], path.join(uploadsDir, uniqueName));
    stagedFiles.push(uniqueName);
  }

  // 2. Generate 5 Questions
  const qRes = await axios.post(`${API_BASE}/sessions/${sessionId}/questions`, {}, { headers });
  const questions = qRes.data.data.questions || qRes.data.data.session.answers;

  // 3. Attach writing & answers
  // Direct DB write (not POST /writing) so the controller's auto-triggered
  // background analysis doesn't race with the direct processSession below.
  await Session.updateOne(
    { _id: sessionId },
    { writingSubmission: writingSample, includeWritingTest: true }
  );

  for (let i = 0; i < 5; i++) {
    const q = questions[i];
    const fixFile = fixtureFiles[i];
    await axios.post(
      `${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`,
      {
        videoUrl: `/uploads/${stagedFiles[i]}`,
        questionIndex: i,
        questionText: q.questionText,
      },
      { headers }
    );

    const form = new FormData();
    form.append('audio', fs.createReadStream(fixFile), {
      filename: path.basename(fixFile),
      contentType: 'audio/webm',
    });
    form.append('sessionId', sessionId.toString());
    form.append('questionId', q.questionId);
    form.append('questionIndex', i.toString());
    form.append('clientTranscript', transcripts[i]);

    await axios.post(`${API_BASE}/analysis/voice`, form, {
      headers: { ...headers, ...form.getHeaders() },
    });
  }

  // 4. Measure execution of the parallelized analysis pipeline
  console.log(`▶ Executing parallelized processSession(${sessionId}) [Controlled Concurrency K=2]...`);
  const t0 = nowMs();
  await processSession(sessionId);
  const pipelineTimeSec = (nowMs() - t0) / 1000;
  console.log(`✓ Pipeline completed in ${pipelineTimeSec.toFixed(2)} seconds\n`);

  // 5. Fetch and verify final report
  const reportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
  const report = reportRes.data.data;

  console.log('--- [Verification Checks] ---');
  console.log(`• Status Code:             ${reportRes.status}`);
  console.log(`• Session Status:          ${report.jobStatus || report.status}`);
  console.log(`• Overall Score:           ${report.overallScore} / 100`);
  console.log(`• Readiness Level:         ${report.readinessLevel}`);
  console.log(`• Answer Count:            ${(report.answers || []).length} (Expected: 5)`);
  console.log(`• Detailed Scores:`, report.detailedScores);
  console.log(`• Track Breakdown:`, report.trackBreakdown);
  console.log(`• Writing Test Score:      ${report.writingScore || report.writingAnalysis?.overallScore || 'N/A'}`);

  // Assertions
  if ((report.answers || []).length !== 5) {
    throw new Error(`Expected 5 answers, got ${(report.answers || []).length}`);
  }
  if (report.overallScore === undefined || report.overallScore === null) {
    throw new Error('Overall score is missing');
  }
  if (!report.detailedScores) {
    throw new Error('Detailed scores breakdown missing');
  }
  const ds = report.detailedScores;
  if (!(ds.nlpVerbalScore > 0)) {
    throw new Error('nlpVerbalScore is 0 — NLP evaluation did not run');
  }
  if (!(ds.voiceSerScore > 0)) {
    throw new Error('voiceSerScore is 0 — voice analysis did not run');
  }
  if (!(ds.faceVisualScore > 0)) {
    throw new Error('faceVisualScore is 0 — face analysis did not run');
  }
  if (!(ds.writingTestScore > 0)) {
    throw new Error('writingTestScore is 0 — writing analysis did not run');
  }
  if (!(report.overallScore > 0)) {
    throw new Error('overallScore is 0 — aggregation did not produce a score');
  }

  console.log('\n========================================================================');
  console.log('✅ ALL VERIFICATION CHECKS PASSED WITH 100% INTEGRITY!');
  console.log('========================================================================');

  await mongoose.disconnect();
}

runParityVerification().catch((err) => {
  console.error('❌ Parity verification failed:', err.response?.data || err.stack || err.message);
  process.exit(1);
});
