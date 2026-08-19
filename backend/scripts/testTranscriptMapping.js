import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { signAccessToken } from '../utils/jwt.js';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');
  
  const user = await User.findOne();
  if (!user) {
    console.error('No user found in DB to run tests.');
    process.exit(1);
  }
  
  const token = signAccessToken(user._id);
  const headers = { Authorization: `Bearer ${token}` };

  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE QUESTION-TO-TRANSCRIPT MAPPING TESTS');
  console.log('================================================================\n');

  // Helper to run full test session
  async function testInterviewFlow(testName, count, customTranscripts = null) {
    console.log(`▶ Starting ${testName} (count: ${count})...`);

    // 1. Create Session
    const createRes = await axios.post(
      `${API_BASE}/sessions`,
      {
        role: 'Full Stack Engineer',
        interviewType: 'technical',
        questionCount: count,
        candidateName: 'Automated Test Candidate',
      },
      { headers }
    );
    const session = createRes.data.data.session;
    const sessionId = session._id;

    // 2. Generate Questions
    const qRes = await axios.post(
      `${API_BASE}/sessions/${sessionId}/questions`,
      {},
      { headers }
    );
    const questions = qRes.data.data.questions || qRes.data.data.session.answers;
    
    if (questions.length !== count) {
      throw new Error(`Expected ${count} questions generated, got ${questions.length}`);
    }

    // 3. Simulate Answering Questions (concurrent / sequential)
    for (let i = 0; i < count; i++) {
      const q = questions[i];
      const transcriptText = customTranscripts 
        ? customTranscripts[i] 
        : `Answer for question number ${i + 1} explaining technical details thoroughly.`;

      // 3a. Upload Answer
      await axios.post(
        `${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`,
        {
          videoUrl: `/uploads/test-answer-${sessionId}-${i}.webm`,
          questionIndex: i,
          questionText: q.questionText,
        },
        { headers }
      );

      // 3b. Transcribe Answer (using json payload or form)
      const form = new (await import('form-data')).default();
      form.append('audio', Buffer.from('RIFF_test_audio_bytes'), {
        filename: 'answer.webm',
        contentType: 'audio/webm'
      });
      form.append('sessionId', sessionId.toString());
      form.append('questionId', q.questionId);
      form.append('questionIndex', i.toString());
      form.append('clientTranscript', transcriptText);

      await axios.post(
        `${API_BASE}/analysis/voice`,
        form,
        { headers: { ...headers, ...form.getHeaders() } }
      );
    }

    // 4. Trigger Analysis
    await axios.post(`${API_BASE}/analysis/${sessionId}/start`, {}, { headers });

    // Wait a brief moment for analysis processing
    await new Promise((r) => setTimeout(r, 1200));

    // 5. Fetch Report
    const reportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
    const report = reportRes.data.data;
    const reportAnswers = report.answers || [];

    console.log(`   Report received with ${reportAnswers.length} answers.`);

    // 6. Assertions
    if (reportAnswers.length !== count) {
      throw new Error(`FAIL: Expected exactly ${count} answers in report, but found ${reportAnswers.length}!`);
    }

    for (let i = 0; i < count; i++) {
      const ans = reportAnswers[i];
      const expectedText = customTranscripts 
        ? customTranscripts[i] 
        : `Answer for question number ${i + 1} explaining technical details thoroughly.`;
      const actualTranscript = ans.voiceAnalysis?.transcript || ans.transcript || '';

      if (!actualTranscript) {
        throw new Error(`FAIL: Question ${i + 1} transcript is EMPTY!`);
      }

      if (actualTranscript !== expectedText) {
        throw new Error(`FAIL: Question ${i + 1} transcript mismatch!\n  Expected: "${expectedText}"\n  Actual: "${actualTranscript}"`);
      }

      console.log(`   ✓ Question ${i + 1}: "${ans.questionText?.slice(0, 35)}..." -> Transcript [${actualTranscript.slice(0, 30)}...] matched!`);
    }

    // 7. Verify persistence after reload
    const reloadedReportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
    if ((reloadedReportRes.data.data.answers || []).length !== count) {
      throw new Error(`FAIL: Persisted report length changed on reload!`);
    }

    console.log(`✅ ${testName} PASSED cleanly! (Exactly ${count} questions, 0 phantom rows, perfect mapping)\n`);
    return true;
  }

  // Execute Tests
  await testInterviewFlow('TEST 1: 5 Questions Interview', 5);
  await testInterviewFlow('TEST 2: 3 Questions Interview', 3);
  await testInterviewFlow('TEST 3: 1 Question Interview', 1);
  await testInterviewFlow(
    'TEST 4: 5 Questions with Variable Answer Lengths',
    5,
    [
      'Yes.', // Short Q1
      'In database design, normalization minimizes redundancy and dependency by organizing fields and table relations.', // Medium Q2
      'Deadlock occurs when four conditions are met: mutual exclusion, hold and wait, no preemption, and circular wait.', // Medium Q3
      'I built a real-time collaborative system using WebSocket connections, Redis pub-sub for horizontal scaling, and JWT authentication.', // Long Q4
      'An extraordinarily comprehensive answer discussing ACID transaction guarantees, write-ahead logging, two-phase locking protocols, and crash recovery.' // Long Q5
    ]
  );

  console.log('================================================================');
  console.log('🎉 ALL 4 TEST SUITES PASSED WITH 100% ACCURACY!');
  console.log('================================================================');

  await mongoose.disconnect();
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err.response?.data || err.stack || err.message);
  process.exit(1);
});
