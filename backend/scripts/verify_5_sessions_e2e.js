import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { signAccessToken } from '../utils/jwt.js';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runEndToEndVerification() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');
  
  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    user = await User.findOne();
  }

  const token = signAccessToken(user._id);
  const headers = { Authorization: `Bearer ${token}` };

  console.log('========================================================================');
  console.log(' RUNNING 5-SESSION SAME-RESUME E2E API VERIFICATION BENCHMARK');
  console.log('========================================================================\n');

  const resumeText = `
Candidate: Rahul Sharma
Target Role: Fullstack Systems Engineer
Technical Skills: JavaScript, TypeScript, Python, Go, React, Node.js, FastAPI, Redis, TimescaleDB, PostgreSQL, MongoDB, Docker, WebRTC

PROJECTS
InterviewAI — AI-Powered Mock Interview Platform (React, Node.js, Python, MongoDB, WebRTC)
- Engineered real-time interview simulator streaming video chunks via WebRTC to FastAPI microservices.
- Integrated Whisper ASR and DeepFace computer vision for real-time speech and eye-contact telemetry.
- Solved race conditions and memory leaks during concurrent browser video transcoding using asynchronous worker queues.

CloudScale Metrics — Distributed Telemetry Pipeline (Go, Redis, TimescaleDB, Prometheus)
- Architected high-throughput metric ingestion service capable of processing 100k events/sec.
- Implemented sliding-window aggregations and rate-limiting using Redis sorted sets and Lua scripts.
- Reduced query latency by 45% by partitioning PostgreSQL time-series tables and adding composite indexes.

E-Commerce Microservices Platform (Node.js, PostgreSQL, Kafka, Docker)
- Designed event-driven checkout orchestrator utilizing Saga pattern to manage distributed transactions.
- Built idempotent payment gateway webhooks with exponential backoff and dead-letter queues.
  `;

  const sessionIds = [];
  const allProjectQuestions = [];

  for (let sIdx = 1; sIdx <= 5; sIdx++) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(` [SESSION #${sIdx}] Creating Resume Interview Session...`);
    console.log(`------------------------------------------------------------------------`);

    // 1. Create Session
    const createRes = await axios.post(
      `${API_BASE}/sessions`,
      {
        role: 'Fullstack Systems Engineer',
        interviewType: 'resume',
        questionCount: 5,
        candidateName: 'Rahul Sharma',
        resumeText,
      },
      { headers }
    );
    const session = createRes.data.data.session;
    const sessionId = session._id;
    sessionIds.push(sessionId);

    // 2. Generate Questions
    const qRes = await axios.post(`${API_BASE}/sessions/${sessionId}/questions`, {}, { headers });
    const questions = qRes.data.data.questions || qRes.data.data.session.answers;

    console.log(`Generated ${questions.length} total questions for Session ${sessionId}:`);
    
    let projCount = 0;
    let hrCount = 0;
    let subjectCount = 0;

    questions.forEach((q, i) => {
      const track = q.track || 'subject';
      const dim = q.dimension ? `[${q.dimension.toUpperCase()}] ` : '';
      console.log(`  Q${i+1} [Track: ${track.toUpperCase()}]: ${dim}"${q.questionText}"`);
      
      if (track === 'project') {
        projCount++;
        allProjectQuestions.push({
          sessionId,
          sessionIndex: sIdx,
          dimension: q.dimension,
          questionText: q.questionText,
          projectTitle: q.projectContext?.title
        });
      } else if (track === 'hr') {
        hrCount++;
      } else {
        subjectCount++;
      }

      if (q.questionText.toLowerCase().includes('in your project stack')) {
        throw new Error(`CRITICAL ERROR: Question contains forbidden phrase 'in your project stack': "${q.questionText}"`);
      }
    });

    console.log(`  -> Track Breakdown: ${hrCount} HR, ${subjectCount} Subject, ${projCount} Project Questions`);

    if (projCount < 2) {
      throw new Error(`Expected at least 2 project questions, got ${projCount}`);
    }

    // 3. Test Live Contextual Follow-Up Generation on Project Question
    const projectQ = questions.find((q) => q.track === 'project');
    if (projectQ) {
      const candidateAnswer = "In InterviewAI, we resolved the video transcoding race conditions by implementing Redis-backed BullMQ worker queues with job debouncing and Redis distributed locks.";
      
      console.log(`\n   Simulating Candidate Response for Q [${projectQ.questionText.slice(0, 45)}...]:`);
      console.log(`     Candidate Answer: "${candidateAnswer}"`);

      const followUpRes = await axios.post(
        `${API_BASE}/sessions/${sessionId}/project-followup`,
        {
          questionId: projectQ.questionId,
          questionText: projectQ.questionText,
          answerText: candidateAnswer,
          projectContext: projectQ.projectContext,
        },
        { headers }
      );

      const followUpData = followUpRes.data.data;
      if (followUpData && followUpData.hasFollowUp && followUpData.followUp) {
        console.log(`   Generated Live Follow-Up:`);
        console.log(`     "${followUpData.followUp.questionText}"`);
        console.log(`     (Reasoning: ${followUpData.followUp.reasoning || 'Evaluated technical claim'})`);
      } else {
        console.log(`   No follow-up triggered.`);
      }
    }
  }

  console.log('\n========================================================================');
  console.log(' 5-SESSION DIVERSITY & INTEGRITY SUMMARY');
  console.log('========================================================================');
  console.log(`Total Project Questions across 5 Sessions: ${allProjectQuestions.length}`);
  
  const uniqueTexts = new Set(allProjectQuestions.map((q) => q.questionText.trim().toLowerCase()));
  console.log(`Distinct Project Questions: ${uniqueTexts.size} / ${allProjectQuestions.length} (${Math.round((uniqueTexts.size / allProjectQuestions.length) * 100)}%)`);

  console.log('\nDimensions covered across sessions:');
  const dims = allProjectQuestions.map((q) => q.dimension || 'custom');
  console.log(dims.join(', '));

  console.log('\nProjects referenced:');
  const projRefs = allProjectQuestions.map((q) => q.projectTitle || 'Project');
  console.log(projRefs.join(', '));

  console.log('\n ALL 5 SESSIONS COMPLETED AND VERIFIED WITH 100% SUCCESS!');
  await mongoose.disconnect();
}

runEndToEndVerification().catch((err) => {
  console.error(' E2E Verification failed:', err.response?.data || err.stack || err.message);
  process.exit(1);
});
