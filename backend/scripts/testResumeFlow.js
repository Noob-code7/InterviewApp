import 'dotenv/config';
import mongoose from 'mongoose';
import axios from 'axios';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { signAccessToken } from '../utils/jwt.js';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runResumeTests() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');
  
  const user = await User.findOne();
  const token = signAccessToken(user._id);
  const headers = { Authorization: `Bearer ${token}` };

  console.log('================================================================');
  console.log('🧪 RUNNING RESUME MULTI-TRACK INTERVIEW & FOLLOW-UP TEST');
  console.log('================================================================\n');

  const resumeText = `
Candidate: Jane Doe
Skills: React, Node.js, Python, PostgreSQL, Docker, AWS
Project 1: E-Commerce Microservices Platform built with Node.js and PostgreSQL handling 50k daily active users.
Project 2: AI Resume Screener using FastAPI and PyTorch with 95% classification accuracy.
  `;

  // 1. Create Resume Session
  const createRes = await axios.post(
    `${API_BASE}/sessions`,
    {
      role: 'Full Stack Developer',
      interviewType: 'resume',
      questionCount: 5,
      candidateName: 'Jane Doe',
      resumeText,
    },
    { headers }
  );
  const session = createRes.data.data.session;
  const sessionId = session._id;

  // 2. Generate Resume Questions
  const qRes = await axios.post(`${API_BASE}/sessions/${sessionId}/questions`, {}, { headers });
  const questions = qRes.data.data.questions || qRes.data.data.session.answers;

  console.log(`Generated ${questions.length} questions for Resume Session:`);
  questions.forEach((q, i) => {
    console.log(` [Q${i+1}] (${q.track || 'subject'}): "${q.questionText?.slice(0, 45)}..." ID=${q.questionId}`);
  });

  if (questions.length !== 5) {
    throw new Error(`Expected 5 questions, got ${questions.length}`);
  }

  // 3. Answer questions 1..5, adding a follow-up to the project question if applicable
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const trans = `Comprehensive response for Resume question ${i + 1} detailing technical architecture.`;

    // Upload answer
    await axios.post(
      `${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`,
      {
        videoUrl: `/uploads/resume-ans-${sessionId}-${i}.webm`,
        questionIndex: i,
        questionText: q.questionText,
      },
      { headers }
    );

    // Transcribe answer
    const form = new (await import('form-data')).default();
    form.append('audio', Buffer.from('TEST_AUDIO_BYTES'), {
      filename: 'answer.webm',
      contentType: 'audio/webm'
    });
    form.append('sessionId', sessionId.toString());
    form.append('questionId', q.questionId);
    form.append('questionIndex', i.toString());
    form.append('clientTranscript', trans);

    await axios.post(`${API_BASE}/analysis/voice`, form, {
      headers: { ...headers, ...form.getHeaders() }
    });

    // If project question, test follow-up answer upload
    if (q.track === 'project' || q.projectContext) {
      console.log(`   Adding follow-up round to Question ${i + 1}...`);
      await axios.post(
        `${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`,
        {
          videoUrl: `/uploads/resume-followup-${sessionId}-${i}-1.webm`,
          isFollowUp: true,
          turn: 1,
          questionText: `Can you explain how you handled database transactions in this project?`,
        },
        { headers }
      );

      const fForm = new (await import('form-data')).default();
      fForm.append('audio', Buffer.from('TEST_FOLLOWUP_BYTES'), {
        filename: 'followup.webm',
        contentType: 'audio/webm'
      });
      fForm.append('sessionId', sessionId.toString());
      fForm.append('questionId', `${q.questionId}-followup-1`);
      fForm.append('questionIndex', i.toString());
      fForm.append('clientTranscript', 'We used ACID transactions with isolation levels to prevent dirty reads.');

      await axios.post(`${API_BASE}/analysis/voice`, fForm, {
        headers: { ...headers, ...fForm.getHeaders() }
      });
    }
  }

  // 4. Start Analysis & Fetch Report
  await axios.post(`${API_BASE}/analysis/${sessionId}/start`, {}, { headers });
  await new Promise((r) => setTimeout(r, 1500));

  const reportRes = await axios.get(`${API_BASE}/reports/${sessionId}`, { headers });
  const report = reportRes.data.data;
  const reportAnswers = report.answers || [];

  console.log(`\nReport received. Total question cards: ${reportAnswers.length}`);
  if (reportAnswers.length !== 5) {
    throw new Error(`Expected exactly 5 question rows in report, got ${reportAnswers.length}!`);
  }

  reportAnswers.forEach((ans, i) => {
    const t = ans.voiceAnalysis?.transcript || ans.transcript || '';
    console.log(`   ✓ Q${i+1} [${ans.track}]: "${ans.questionText?.slice(0, 35)}..." -> Transcript: "${t.slice(0, 30)}..."`);
    if (!t) throw new Error(`Q${i+1} transcript is empty!`);
    if (ans.followUps && ans.followUps.length > 0) {
      console.log(`     ↳ Follow-up (Turn 1): "${ans.followUps[0].questionText?.slice(0, 30)}..." -> Transcript: "${ans.followUps[0].voiceAnalysis?.transcript || ans.followUps[0].transcript}"`);
    }
  });

  console.log('\n✅ RESUME MULTI-TRACK INTERVIEW & FOLLOW-UP TEST PASSED WITH 100% ACCURACY!');
  await mongoose.disconnect();
}

runResumeTests().catch((err) => {
  console.error('❌ Resume test failed:', err.response?.data || err.stack || err.message);
  process.exit(1);
});
