import 'dotenv/config';
import mongoose from 'mongoose';
import Session from '../models/Session.js';

const sid = process.argv[2];
if (!sid) { console.error('usage: node scripts/__debug_face.mjs <sessionId>'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');
const s = await Session.findById(sid);
if (!s) { console.error('not found'); process.exit(1); }
console.log('session status:', s.status, 'jobStatus:', s.jobStatus);
for (const [i, a] of (s.answers || []).entries()) {
  console.log(`--- answer ${i} questionId=${a.questionId} videoUrl=${a.videoUrl}`);
  console.log('  faceAnalysis:', JSON.stringify(a.faceAnalysis));
  console.log('  voiceAnalysis keys:', a.voiceAnalysis ? Object.keys(a.voiceAnalysis) : null);
}
await mongoose.disconnect();