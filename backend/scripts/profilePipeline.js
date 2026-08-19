import 'dotenv/config';
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
import llmService from '../services/llmService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

const API_BASE = 'http://127.0.0.1:5000/api';
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001';
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://127.0.0.1:8002';
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://127.0.0.1:8003';

// Accurate timer helper
const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

async function runProfiler() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');

  const user = await User.findOne();
  if (!user) {
    console.error('No test user found in DB');
    process.exit(1);
  }
  const token = signAccessToken(user._id);
  const headers = { Authorization: `Bearer ${token}` };

  console.log('========================================================================');
  console.log('🔍 PROFILING COMPLETE POST-INTERVIEW REPORT GENERATION PIPELINE');
  console.log('========================================================================\n');

  // Find real media files from uploads
  const uploadFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.webm') && fs.statSync(path.join(UPLOADS_DIR, f)).size > 50000);
  const sampleMediaFiles = uploadFiles.slice(0, 5).map((f) => path.join(UPLOADS_DIR, f));

  if (sampleMediaFiles.length === 0) {
    console.warn('⚠️ No large webm files found, using standard test files.');
  }

  console.log(`Found ${sampleMediaFiles.length} realistic media assets in uploads directory for benchmarking.`);

  // ──────────────────────────────────────────────────────────────────────────
  // PART 1: MICROBENCHMARK INDIVIDUAL AI/ML & DB SERVICES
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- [Stage 1: Microbenchmarking Individual Services] ---');

  // 1A. Database Read & Write Speed
  const dbReadStart = nowMs();
  const dbSessions = await Session.find().limit(5).lean();
  const dbReadTime = nowMs() - dbReadStart;

  const dbWriteStart = nowMs();
  const testSession = new Session({
    userId: user._id,
    role: 'Benchmark Role',
    interviewType: 'technical',
    status: 'setup',
  });
  await testSession.save();
  const dbWriteTime = nowMs() - dbWriteStart;
  await Session.deleteOne({ _id: testSession._id });

  console.log(`• MongoDB Read (5 records):  ${dbReadTime.toFixed(2)} ms`);
  console.log(`• MongoDB Write (1 record):  ${dbWriteTime.toFixed(2)} ms`);

  // 1B. Local NLP Service Benchmark
  const sampleTranscript = "In database design, normalization organizes tables to minimize redundancy and eliminate anomalies like insertion, update, and deletion anomalies. We decompose tables into 1NF, 2NF, 3NF, and BCNF using functional dependencies.";
  let nlpLatency = 0;
  try {
    const nlpStart = nowMs();
    const nlpRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
      question: "Why is normalization required in database design?",
      transcript: sampleTranscript,
      questionType: "technical",
      keywords: ["normalization", "redundancy", "anomalies", "1NF", "2NF", "3NF", "functional dependencies"],
    }, { timeout: 10000 });
    nlpLatency = nowMs() - nlpStart;
    console.log(`• NLP Service (/analyze):     ${nlpLatency.toFixed(2)} ms (Engine: ${nlpRes.data.data?.evaluationEngine || 'local'})`);
  } catch (err) {
    console.warn(`• NLP Service (/analyze):     FAILED (${err.message})`);
  }

  // 1C. Written Test NLP Analysis Benchmark
  const sampleWriting = "Microservices architecture divides a large monolith into loosely-coupled, independently deployable services communicating over lightweight protocols such as HTTP/REST or gRPC. Each service manages its own isolated database to ensure loose coupling and bounded contexts. Key challenges include distributed transaction management, network latency, distributed logging, and eventual consistency.";
  let writingLatency = 0;
  try {
    const wStart = nowMs();
    const wRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
      question: "Explain the architecture and trade-offs of microservices systems.",
      text: sampleWriting,
      transcript: sampleWriting,
      questionType: "technical",
    }, { timeout: 10000 });
    writingLatency = nowMs() - wStart;
    console.log(`• Writing Test NLP (/analyze): ${writingLatency.toFixed(2)} ms`);
  } catch (err) {
    console.warn(`• Writing Test NLP (/analyze): FAILED (${err.message})`);
  }

  // 1D. Voice Service (Faster-Whisper STT + PyTorch SER) Benchmark
  let voiceLatency = 0;
  if (sampleMediaFiles.length > 0) {
    try {
      const vStart = nowMs();
      const vForm = new FormData();
      vForm.append('audio', fs.createReadStream(sampleMediaFiles[0]), {
        filename: 'benchmark_audio.webm',
        contentType: 'audio/webm',
      });
      const vRes = await axios.post(`${VOICE_SERVICE_URL}/analyze`, vForm, {
        headers: vForm.getHeaders(),
        timeout: 45000,
      });
      voiceLatency = nowMs() - vStart;
      console.log(`• Voice Service (/analyze):   ${voiceLatency.toFixed(2)} ms (Emotion: ${vRes.data.data?.dominantEmotion}, STT: "${(vRes.data.data?.transcript || '').slice(0, 30)}...")`);
    } catch (err) {
      console.warn(`• Voice Service (/analyze):   FAILED (${err.message})`);
    }
  }

  // 1E. Face Service (OpenCV + DeepFace) Benchmark
  let faceLatency = 0;
  if (sampleMediaFiles.length > 0) {
    try {
      const fStart = nowMs();
      const fForm = new FormData();
      fForm.append('video', fs.createReadStream(sampleMediaFiles[0]), {
        filename: 'benchmark_video.webm',
        contentType: 'video/webm',
      });
      const fRes = await axios.post(`${FACE_SERVICE_URL}/analyze`, fForm, {
        headers: fForm.getHeaders(),
        timeout: 60000,
      });
      faceLatency = nowMs() - fStart;
      console.log(`• Face Service (/analyze):    ${faceLatency.toFixed(2)} ms (Confidence: ${fRes.data.data?.confidenceScore})`);
    } catch (err) {
      console.warn(`• Face Service (/analyze):    FAILED (${err.message})`);
    }
  }

  // 1F. LLM Call Benchmark (OpenRouter)
  let llmLatency = 0;
  let llmInputSize = 0;
  let llmOutputSize = 0;
  let llmModelName = 'nvidia/nemotron-3-super-120b-a12b:free';
  try {
    const llmStart = nowMs();
    const projectContext = {
      title: "Real-time Collaboration Platform",
      techStack: ["React", "Node.js", "Socket.io", "Redis", "MongoDB"],
      architecture: "Event-driven WebSocket cluster with Redis Pub/Sub adapter",
      challenges: "Handling concurrent operational transforms and network reconnections",
    };
    const questionText = "How did you maintain data consistency across distributed WebSocket instances?";
    const candidateAnswer = "We implemented Redis Pub/Sub backplane with sticky sessions at the load balancer. When a mutation occurs, we serialize the operational transformation delta and broadcast it through Redis channels.";

    const promptText = JSON.stringify(projectContext) + questionText + candidateAnswer;
    llmInputSize = promptText.length;

    const llmResult = await llmService.evaluateProjectAnswer(projectContext, questionText, candidateAnswer, false);
    llmLatency = nowMs() - llmStart;
    llmOutputSize = JSON.stringify(llmResult || {}).length;
    console.log(`• LLM Evaluation (OpenRouter): ${llmLatency.toFixed(2)} ms (Score: ${llmResult?.overallScore})`);
  } catch (err) {
    console.warn(`• LLM Evaluation (OpenRouter): FAILED (${err.message})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PART 2: END-TO-END PIPELINE MEASUREMENT (RUN 1, RUN 2, RUN 3)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- [Stage 2: End-to-End Pipeline Profiling (3 Runs)] ---');

  const runs = [];

  for (let runIndex = 1; runIndex <= 3; runIndex++) {
    console.log(`\n▶ Executing Pipeline Profiling Run ${runIndex}...`);

    const stageTimings = {
      apiInit: 0,
      dbRead: 0,
      writingNlp: 0,
      faceAnalysisTotal: 0,
      faceCalls: 0,
      voiceAnalysisTotal: 0,
      voiceCalls: 0,
      nlpAnalysisTotal: 0,
      nlpCalls: 0,
      llmAnalysisTotal: 0,
      llmCalls: 0,
      scoreAggregation: 0,
      dbWrite: 0,
      reportApi: 0,
      totalWallClock: 0,
    };

    const overallStart = nowMs();

    // 1. Session Setup & Question Generation
    const t0 = nowMs();
    const createRes = await axios.post(
      `${API_BASE}/sessions`,
      {
        role: 'Senior Full Stack Engineer',
        interviewType: 'technical',
        questionCount: 5,
        candidateName: `Profile Candidate ${runIndex}`,
        includeWritingTest: true,
      },
      { headers }
    );
    const session = createRes.data.data.session;
    const sessionId = session._id;

    const qRes = await axios.post(`${API_BASE}/sessions/${sessionId}/questions`, {}, { headers });
    const questions = qRes.data.data.questions || qRes.data.data.session.answers;
    stageTimings.apiInit = nowMs() - t0;

    // Attach writing test submission
    await axios.post(`${API_BASE}/sessions/${sessionId}/writing`, {
      text: sampleWriting,
    }, { headers });

    // 2. Populate 5 Questions with Media and Transcripts
    const transcripts = [
      "Process isolation in operating systems prevents processes from interfering with each other memory spaces using virtual memory and page tables.",
      "Deadlock requires four simultaneous conditions: mutual exclusion, hold and wait, no preemption, and circular wait. We can prevent it using resource ordering.",
      "TCP is connection-oriented with guaranteed delivery, congestion control, and packet reordering. UDP is connectionless with lower latency.",
      "We built a real-time messaging engine with Redis Pub/Sub, WebSockets, and MongoDB replica sets with change streams for event sourcing.",
      "ACID guarantees Atomicity, Consistency, Isolation, and Durability. We use multi-version concurrency control and write-ahead logging.",
    ];

    for (let i = 0; i < 5; i++) {
      const q = questions[i];
      const mediaPath = sampleMediaFiles[i % sampleMediaFiles.length] || '';
      
      await axios.post(
        `${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`,
        {
          videoUrl: mediaPath ? `/uploads/${path.basename(mediaPath)}` : `/uploads/q-dummy-${i}.webm`,
          questionIndex: i,
          questionText: q.questionText,
        },
        { headers }
      );

      // Pre-set transcript
      const form = new FormData();
      form.append('audio', mediaPath ? fs.createReadStream(mediaPath) : Buffer.from('RIFF_test_bytes'), {
        filename: 'answer.webm',
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

    // 3. Measure startAnalysis & processSession Pipeline Stages Directly
    const analysisPipelineStart = nowMs();

    // Measure Writing NLP Stage
    const wStart = nowMs();
    const wNlpRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
      question: "Technical Writing Assessment",
      text: sampleWriting,
      transcript: sampleWriting,
      questionType: "technical",
    }, { timeout: 15000 });
    stageTimings.writingNlp = nowMs() - wStart;

    // Measure per-question sequential processing
    for (let i = 0; i < 5; i++) {
      const mediaPath = sampleMediaFiles[i % sampleMediaFiles.length];

      // A. Face Analysis
      if (mediaPath && fs.existsSync(mediaPath)) {
        try {
          const fStart = nowMs();
          const fForm = new FormData();
          fForm.append('video', fs.createReadStream(mediaPath), {
            filename: path.basename(mediaPath),
            contentType: 'video/webm',
          });
          await axios.post(`${FACE_SERVICE_URL}/analyze`, fForm, {
            headers: fForm.getHeaders(),
            timeout: 60000,
          });
          const fDur = nowMs() - fStart;
          stageTimings.faceAnalysisTotal += fDur;
          stageTimings.faceCalls++;
        } catch (fErr) {
          // ignore or record
        }
      }

      // B. Voice Analysis
      if (mediaPath && fs.existsSync(mediaPath)) {
        try {
          const vStart = nowMs();
          const vForm = new FormData();
          vForm.append('audio', fs.createReadStream(mediaPath), {
            filename: path.basename(mediaPath),
            contentType: 'audio/webm',
          });
          await axios.post(`${VOICE_SERVICE_URL}/analyze`, vForm, {
            headers: vForm.getHeaders(),
            timeout: 45000,
          });
          const vDur = nowMs() - vStart;
          stageTimings.voiceAnalysisTotal += vDur;
          stageTimings.voiceCalls++;
        } catch (vErr) {
          // ignore
        }
      }

      // C. NLP / LLM Verbal Analysis
      const nStart = nowMs();
      const nRes = await axios.post(`${NLP_SERVICE_URL}/analyze`, {
        question: questions[i].questionText,
        transcript: transcripts[i],
        questionType: "technical",
      }, { timeout: 15000 });
      const nDur = nowMs() - nStart;
      stageTimings.nlpAnalysisTotal += nDur;
      stageTimings.nlpCalls++;
    }

    // Measure Score Aggregation & DB Write
    const aggStart = nowMs();
    const reportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
    stageTimings.reportApi = nowMs() - aggStart;

    stageTimings.totalWallClock = nowMs() - overallStart;

    console.log(`   ✓ Run ${runIndex} finished in ${(stageTimings.totalWallClock / 1000).toFixed(2)}s`);
    console.log(`     - Face Analysis (5 calls):  ${(stageTimings.faceAnalysisTotal / 1000).toFixed(2)}s`);
    console.log(`     - Voice Analysis (5 calls): ${(stageTimings.voiceAnalysisTotal / 1000).toFixed(2)}s`);
    console.log(`     - NLP Verbal (5 calls):     ${(stageTimings.nlpAnalysisTotal / 1000).toFixed(2)}s`);
    console.log(`     - Writing Test NLP:         ${(stageTimings.writingNlp / 1000).toFixed(2)}s`);
    console.log(`     - Report API & DB Write:    ${(stageTimings.reportApi).toFixed(2)}ms`);

    runs.push(stageTimings);
  }

  // Calculate Averages
  const avg = {
    apiInit: (runs[0].apiInit + runs[1].apiInit + runs[2].apiInit) / 3,
    writingNlp: (runs[0].writingNlp + runs[1].writingNlp + runs[2].writingNlp) / 3,
    faceAnalysisTotal: (runs[0].faceAnalysisTotal + runs[1].faceAnalysisTotal + runs[2].faceAnalysisTotal) / 3,
    voiceAnalysisTotal: (runs[0].voiceAnalysisTotal + runs[1].voiceAnalysisTotal + runs[2].voiceAnalysisTotal) / 3,
    nlpAnalysisTotal: (runs[0].nlpAnalysisTotal + runs[1].nlpAnalysisTotal + runs[2].nlpAnalysisTotal) / 3,
    reportApi: (runs[0].reportApi + runs[1].reportApi + runs[2].reportApi) / 3,
    totalWallClock: (runs[0].totalWallClock + runs[1].totalWallClock + runs[2].totalWallClock) / 3,
  };

  console.log('\n========================================================================');
  console.log('📊 FINAL PROFILING MEASUREMENTS SUMMARY');
  console.log('========================================================================');
  console.log(`Runs Measured: 3 | Average Pipeline Wall-Clock Time: ${(avg.totalWallClock / 1000).toFixed(2)} s\n`);

  console.log(JSON.stringify({
    microbenchmarks: {
      dbReadMs: dbReadTime,
      dbWriteMs: dbWriteTime,
      nlpLatencyMs: nlpLatency,
      writingLatencyMs: writingLatency,
      voiceLatencyMs: voiceLatency,
      faceLatencyMs: faceLatency,
      llmLatencyMs: llmLatency,
      llmInputSize,
      llmOutputSize,
      llmModelName,
    },
    run1: runs[0],
    run2: runs[1],
    run3: runs[2],
    average: avg,
  }, null, 2));

  await mongoose.disconnect();
}

runProfiler().catch((err) => {
  console.error('❌ Profiler error:', err.response?.data || err.stack || err.message);
  process.exit(1);
});
