import { readFileSync } from 'fs';

const BASE = "http://127.0.0.1:5000";
let token = "";
const random = Math.random().toString(36).slice(2, 8);
const email = `faceprobe-${random}@example.com`;

const req = async (method, url, body, isForm = false) => {
  const headers = { Authorization: `Bearer ${token}` };
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${url}`, {
    method, headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let r = await req("POST", "/api/auth/register", { name: "Face Probe", email, password: "password123", role: "student", college: "tc" });
  token = r.data.data?.accessToken || r.data.accessToken;

  r = await req("POST", "/api/sessions", { role: "Software Engineer", interviewType: "technical", questionCount: 2, candidateName: "Face Probe" });
  const sessionId = r.data.data.session._id;
  console.log("session:", sessionId);

  r = await req("POST", `/api/sessions/${sessionId}/questions`);
  const questions = r.data.data.questions || [];
  console.log("questions:", questions.length);

  // Upload mp4 to q0
  const mp4 = readFileSync("C:\\Users\\HP\\AppData\\Local\\Temp\\opencode\\face_neutral.mp4");
  const formV = new FormData();
  formV.append("video", new Blob([mp4], { type: "video/mp4" }), "answer.mp4");
  r = await req("POST", `/api/sessions/${sessionId}/answers/${questions[0].questionId}`, formV, true);
  console.log("upload q0 status:", r.status, "videoUrl:", r.data.data?.answer?.videoUrl);

  // Upload wav to q1
  const wav = readFileSync("C:\\Users\\HP\\AppData\\Local\\Temp\\opencode\\fu-speech.wav");
  const formA = new FormData();
  formA.append("video", new Blob([wav], { type: "audio/wav" }), "answer.wav");
  r = await req("POST", `/api/sessions/${sessionId}/answers/${questions[1].questionId}`, formA, true);
  console.log("upload q1 status:", r.status, "videoUrl:", r.data.data?.answer?.videoUrl);

  r = await req("POST", `/api/analysis/${sessionId}/start`);
  console.log("start analysis:", r.status);

  let last = "";
  for (let i = 0; i < 50 && !last.includes("completed") && !last.includes("failed"); i++) {
    await sleep(1000);
    r = await req("GET", `/api/sessions/${sessionId}`);
    const s = r.data.data?.session || r.data.data;
    last = s?.status || s?.jobStatus || "";
    const a0 = (s.answers || []).find((a) => String(a.questionId) === String(questions[0].questionId));
    const a1 = (s.answers || []).find((a) => String(a.questionId) === String(questions[1].questionId));
    console.log(`t+${i + 1}s status=${last} | q0.videoUrl=${a0?.videoUrl} faceC=${a0?.faceAnalysis?.confidenceScore} | q1.videoUrl=${a1?.videoUrl} voiceLen=${(a1?.voiceAnalysis?.transcript || "").length}`);
  }
  console.log("final:", last);
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.response?.data || e.stack || e.message); process.exit(1); });