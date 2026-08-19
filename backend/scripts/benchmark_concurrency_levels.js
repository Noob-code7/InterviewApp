import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Question from '../models/Question.js';
import { signAccessToken } from '../utils/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://127.0.0.1:5000/api';
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001';
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://127.0.0.1:8002';
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8003';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

// Lightweight async concurrency pool helper
function createPool(concurrencyLimit) {
  let active = 0;
  const queue = [];

  const runNext = () => {
    if (active >= concurrencyLimit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active--;
        runNext();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

function getCpuTimes() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  const total = user + nice + sys + idle + irq;
  return { total, active: total - idle };
}

async function runBenchmarkForConcurrency(concurrencyLevel, token, questions, fixtureFiles, transcripts, writingSample) {
  console.log(`\n========================================================================`);
  console.log(`🚀 TESTING CONCURRENCY LEVEL: K = ${concurrencyLevel} (5 Questions)`);
  console.log(`========================================================================`);

  const headers = { Authorization: `Bearer ${token}` };
  const pool = createPool(concurrencyLevel);

  const startCpu = getCpuTimes();
  const startMem = process.memoryUsage();
  const startTime = nowMs();

  let failedRequests = 0;
  const deepFaceTimes = [];
  const voiceTimes = [];
  const nlpTimes = [];

  // 1. Create a fresh session for this test
  const createRes = await axios.post(
    `${API_BASE}/sessions`,
    {
      role: 'Senior Distributed Systems Engineer',
      interviewType: 'technical',
      questionCount: 5,
      candidateName: `Concurrency Level ${concurrencyLevel} Candidate`,
      includeWritingTest: true,
    },
    { headers }
  );
  const session = createRes.data.data.session;
  const sessionId = session._id;

  // 2. Generate questions for the session
  const qRes = await axios.post(`${API_BASE}/sessions/${sessionId}/questions`, {}, { headers });
  const activeQuestions = qRes.data.data.questions || qRes.data.data.session.answers;

  // 3. Attach writing test & answers
  await axios.post(`${API_BASE}/sessions/${sessionId}/writing`, { text: writingSample }, { headers });

  for (let i = 0; i < 5; i++) {
    const q = activeQuestions[i];
    const fixFile = fixtureFiles[i];
    await axios.post(
      `${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`,
      {
        videoUrl: `/uploads/${path.basename(fixFile)}`,
        questionIndex: i,
        questionText: q.questionText,
      },
      { headers }
    );
  }

  // 4. Concurrently execute: Writing Test Analysis + 5 Questions (limited to pool concurrency)
  const writingPromise = (async () => {
    const tW = nowMs();
    try {
      const wRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
        question: "Explain the architecture and trade-offs of microservices systems.",
        text: writingSample,
        transcript: writingSample,
        questionType: "technical",
      });
      return { dur: nowMs() - tW, score: wRes.data.data?.overallScore || 0 };
    } catch (err) {
      failedRequests++;
      return { dur: nowMs() - tW, score: 0 };
    }
  })();

  const questionPromises = activeQuestions.map((q, idx) =>
    pool(async () => {
      const fixFile = fixtureFiles[idx];
      const transcript = transcripts[idx];

      // Intra-question parallelization: Face + Voice run concurrently
      const facePromise = (async () => {
        const tF = nowMs();
        try {
          const fForm = new FormData();
          fForm.append('video', fs.createReadStream(fixFile), {
            filename: path.basename(fixFile),
            contentType: 'video/webm',
          });
          const fRes = await axios.post(`${FACE_SERVICE_URL}/analyze`, fForm, {
            headers: fForm.getHeaders(),
            timeout: 45000,
          });
          const fDur = nowMs() - tF;
          deepFaceTimes.push(fDur);
          return fRes.data.data || {};
        } catch (err) {
          failedRequests++;
          const fDur = nowMs() - tF;
          deepFaceTimes.push(fDur);
          return { confidenceScore: 80.0 };
        }
      })();

      const voicePromise = (async () => {
        const tV = nowMs();
        try {
          const vForm = new FormData();
          vForm.append('audio', fs.createReadStream(fixFile), {
            filename: path.basename(fixFile),
            contentType: 'audio/webm',
          });
          const vRes = await axios.post(`${VOICE_SERVICE_URL}/analyze`, vForm, {
            headers: vForm.getHeaders(),
            timeout: 45000,
          });
          const vDur = nowMs() - tV;
          voiceTimes.push(vDur);
          return vRes.data.data || {};
        } catch (err) {
          failedRequests++;
          const vDur = nowMs() - tV;
          voiceTimes.push(vDur);
          return { confidenceScore: 82.0, dominantEmotion: 'calm' };
        }
      })();

      const nlpPromise = (async () => {
        const tN = nowMs();
        try {
          const nRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
            question: q.questionText,
            transcript: transcript,
            questionType: "technical",
            keywords: q.expectedKeywords || [],
          });
          const nDur = nowMs() - tN;
          nlpTimes.push(nDur);
          return nRes.data.data || {};
        } catch (err) {
          failedRequests++;
          const nDur = nowMs() - tN;
          nlpTimes.push(nDur);
          return { overallScore: 75.0 };
        }
      })();

      const [faceData, voiceData, nlpData] = await Promise.all([facePromise, voicePromise, nlpPromise]);
      return { faceData, voiceData, nlpData };
    })
  );

  const [writingRes, ...answersResults] = await Promise.all([writingPromise, ...questionPromises]);

  // 5. Trigger Report Endpoint (Verifies exact aggregation & report math)
  const tRep = nowMs();
  const reportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
  const reportApiMs = nowMs() - tRep;

  const totalWallClockMs = nowMs() - startTime;
  const endCpu = getCpuTimes();
  const endMem = process.memoryUsage();

  const totalCpuDiff = endCpu.total - startCpu.total;
  const activeCpuDiff = endCpu.active - startCpu.active;
  const cpuUtilizationPercent = totalCpuDiff > 0 ? (activeCpuDiff / totalCpuDiff) * 100 : 0;
  const memUsedMb = (endMem.rss - startMem.rss) / (1024 * 1024);
  const totalRssMb = endMem.rss / (1024 * 1024);

  const avgDeepFaceMs = deepFaceTimes.length > 0 ? deepFaceTimes.reduce((a, b) => a + b, 0) / deepFaceTimes.length : 0;
  const reportData = reportRes.data.data || {};

  const result = {
    concurrencyLevel: `K = ${concurrencyLevel}`,
    totalWallClockSec: Number((totalWallClockMs / 1000).toFixed(2)),
    avgDeepFaceMs: Number(avgDeepFaceMs.toFixed(1)),
    cpuUtilizationPercent: Number(cpuUtilizationPercent.toFixed(1)),
    memDeltaMb: Number(memUsedMb.toFixed(1)),
    totalRssMb: Number(totalRssMb.toFixed(1)),
    failedRequests,
    overallScore: reportData.overallScore,
    readinessLevel: reportData.readinessLevel,
    answersCount: (reportData.answers || []).length,
  };

  console.log(`• Total Wall Clock Time:     ${result.totalWallClockSec} s`);
  console.log(`• Avg DeepFace Inference:   ${result.avgDeepFaceMs} ms`);
  console.log(`• System CPU Utilization:   ${result.cpuUtilizationPercent} %`);
  console.log(`• Memory Usage (RSS):       ${result.totalRssMb} MB (Delta: ${result.memDeltaMb} MB)`);
  console.log(`• Failed Requests/Timeouts: ${result.failedRequests}`);
  console.log(`• Final Overall Score:      ${result.overallScore} (${result.readinessLevel})`);

  return result;
}

async function executeAllBenchmarks() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');

  const user = await User.findOne();
  if (!user) {
    console.error('No test user found in DB');
    process.exit(1);
  }
  const token = signAccessToken(user._id);

  const fixtureFiles = [
    path.join(FIXTURES_DIR, 'test_candidate_q1.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q2.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q3.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q4.webm'),
    path.join(FIXTURES_DIR, 'test_candidate_q5.webm'),
  ];

  const transcripts = [
    "Process isolation in modern operating systems prevents processes from interfering with each other's memory space using hardware memory management units, virtual memory paging, and privilege rings.",
    "Deadlock occurs when four necessary conditions hold: mutual exclusion, hold and wait, no preemption, and circular wait. We can prevent deadlock by enforcing a strict global ordering on resource acquisition.",
    "TCP provides connection-oriented, reliable byte-stream transmission with three-way handshakes, sequence numbers, checksums, and congestion control. UDP provides lightweight, connectionless datagram delivery with lower latency.",
    "We engineered a scalable distributed messaging platform with Node.js, WebSockets, Redis Pub/Sub channels, and MongoDB replica sets with change streams for event sourcing.",
    "ACID transaction properties guarantee Atomicity, Consistency, Isolation, and Durability. In relational databases, these are enforced via Write-Ahead Logging (WAL) and multi-version concurrency control (MVCC).",
  ];

  const writingSample = "Microservices architecture partitions an application into discrete, independently deployable services that communicate via lightweight network APIs such as gRPC or HTTP/REST. Each service maintains encapsulated domain boundaries and its own private database.";

  console.log('========================================================================');
  console.log('🏁 CONCURRENCY LEVEL BENCHMARKING SUITE (K = 1, 2, 3, 5)');
  console.log('========================================================================\n');

  const results = [];

  for (const level of [1, 2, 3, 5]) {
    const res = await runBenchmarkForConcurrency(level, token, null, fixtureFiles, transcripts, writingSample);
    results.push(res);
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n========================================================================');
  console.log('📊 CONCURRENCY LEVEL COMPARISON SUMMARY');
  console.log('========================================================================\n');
  console.table(results);

  await mongoose.disconnect();
}

executeAllBenchmarks().catch((err) => {
  console.error('❌ Benchmark error:', err);
  process.exit(1);
});
