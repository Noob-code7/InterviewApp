import 'dotenv/config';
import mongoose from 'mongoose';
import Session from '../models/Session.js';

const sid = process.argv[2];
if (!sid) { console.error('usage: node scripts/__debug_face2.mjs <sessionId>'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewapp');
const s = await Session.findById(sid).lean();
if (!s) { console.error('not found'); process.exit(1); }
console.log('questionCount:', s.questionCount, 'status:', s.status);
s.answers.forEach((a, i) => {
  console.log(`${i} questionId=${a.questionId}`);
  console.log(`   videoUrl=${JSON.stringify(a.videoUrl)}`);
  console.log(`   audioUrl=${JSON.stringify(a.audioUrl)}`);
  console.log(`   faceC=${a.faceAnalysis?.confidenceScore} faceN=${JSON.stringify(a.faceAnalysis?.notes)}`);
  console.log(`   voiceTransLen=${(a.voiceAnalysis?.transcript || '').length} voiceC=${a.voiceAnalysis?.confidenceScore}`);
  console.log(`   hasNlp=${!!a.nlpAnalysis} nlpOverall=${a.nlpAnalysis?.overallScore}`);
});
await mongoose.disconnect();