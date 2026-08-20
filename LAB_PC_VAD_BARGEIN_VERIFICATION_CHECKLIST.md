# Lab-PC VAD / Barge-In Verification Checklist (WS2.8)

Real-device verification path for the Voice Activity Detection and Barge-In behavior of the
Continuous Conversational Interview Flow. Must be executed on a physical lab PC with a
working microphone and speakers (no headset echo-cancellation features disabled) against a
running full stack (backend + NLP + voice + face + frontend dev server).

## Under-test code (ground truth for the pass criteria)

- `frontend/src/hooks/useVoiceActivityDetector.js`
  - `silenceThresholdMs = 2200` — sustained RMS below `speechThreshold` for this long ends the turn.
  - `thinkingGracePeriodMs = 4000` — silence allowed while the interviewer is "thinking" before auto-advance.
  - `bargeInThreshold = 0.038` with `bargeInSustainMs = 120` — audio-level barge-in during TTS.
  - `minAnswerDurationMs = 3000` — minimum recorded answer length accepted.
  - STT-backed barge-in: a Web Speech interim transcript with `text.length > 0` during TTS fires
    `onBargeIn({ source: "stt_interim", ... })` (see `useVoiceActivityDetector.js:93`).
- `frontend/src/pages/LiveInterviewPage.jsx` — `classifyInterruption` routes barge-ins to
  clarification/answer handling; routing after interview goes to `/interview/processing`.

## Environment prep

- [ ] Chrome (latest) on a lab PC with a physical microphone.
- [ ] Grant microphone permission before starting (about:flags -> web speech on all pages if needed).
- [ ] Disable OS/VPN audio processing that may alter RMS levels.
- [ ] All 4 services running (`backend :5000`, `face :8001`, `voice :8002`, `nlp :8003`) + Mongo.
- [ ] Frontend dev server serving the app.

## Test 1 — Silence auto-advance (2.2 s)

Steps: start a technical interview, answer a question, then stop speaking.
Expected: the turn ends approximately 2.2 s after the last speech (allow +200 ms tolerance).
Record: measured silence duration = ______ ms. PASS / FAIL.

## Test 2 — Thinking grace period (4.0 s)

Steps: after the interviewer starts a question, say nothing for 3 s.
Expected: the interviewer must NOT auto-advance or time out within the 4 s grace window.
Record: observed timeout = ______ ms. PASS / FAIL.

## Test 3 — Min answer enforcement (3.0 s)

Steps: give a 1.5 s utterance as an answer.
Expected: the system either (a) discards it as too short, or (b) prompts for a longer answer,
per the documented UX. Record observed behavior: ______. PASS / FAIL.

## Test 4 — Audio-level barge-in (RMS 0.038 / 120 ms sustain)

Steps: while the interviewer TTS is speaking, talk over it with a normal voice.
Expected: playback is interrupted within ~120 ms of sustained speech exceeding the threshold
and the interview continues with the candidate's turn.
Record: interruption latency = ______ ms. PASS / FAIL.

## Test 5 — STT-backed barge-in (Web Speech interim)

Steps: while TTS is speaking, speak a short phrase that the Web Speech API can transcribe.
Expected: the phrase appears as an interim transcript and `onBargeIn({ source: "stt_interim" })`
fires, ending the TTS even if RMS is below the audio threshold.
Record: fires? YES / NO. PASS / FAIL.

## Test 6 — Barge-in during clarification

Steps: trigger a clarification (interruption with a question) and answer while the
clarification prompt is still being read.
Expected: the prompt is cut off and the answer is recorded without duplication.
Record: PASS / FAIL.

## Test 7 — Post-interview routing

Steps: finish the last question; the interview should navigate to `/interview/processing`
with the session id in state, then to the report on completion.
Record: routes observed = ______. PASS / FAIL.

## Test 8 — End-to-end score integrity on real media

Steps: run the full interview with real audio/video, then open the report.
Expected: `overallScore`, `nlpVerbalScore`, `voiceSerScore`, `faceVisualScore`, and
`writingTestScore` are all non-zero and internally consistent.
Record: scores = ______. PASS / FAIL.

## Sign-off

- Tester: ______
- Date: ______
- Machine/OS: ______
- Browser + version: ______
- Overall result (all 8 must pass): PASS / FAIL
- Notes / defects found: ______