# Lab-PC VAD / Barge-In & Conversational Flow Physical Verification Checklist

This document provides the step-by-step verification protocol for testing the **Continuous Conversational AI Interview Flow** on a **physical machine** equipped with a real microphone and speakers (e.g. laptop or lab PC with ambient room noise, fan, or AC running).

---

## 1. Ground-Truth Runtime Architecture Under Test

* **Adaptive Noise-Floor VAD**: [`frontend/src/hooks/useVoiceActivityDetector.js`](file:///C:/Workspace/Workspace/InterviewApp/frontend/src/hooks/useVoiceActivityDetector.js)
  * Dynamic Noise Floor Tracking: Exponential moving average tracks ambient room noise (0.008 - 0.080 RMS).
  * Adaptive Barge-In Threshold: `Math.max(0.055, noiseFloor * 2.6)` with `bargeInSustainMs = 260ms` and consecutive vocal frame accumulator.
  * TTS Startup Cooldown: Ignores microphone audio during first 350ms of AI TTS playback to eliminate speaker acoustic bleed and turn-on pop.
  * AudioContext Auto-Resume: Automatically recovers from browser suspension.
  * Safe STT-Backed Barge-In: Requires >= 2 words and vocal RMS confirmation before firing STT barge-in.
  * Multi-Signal Answer Completion:
    * Standard verbal answer: >= 4 words, >= 3.0s duration, 2.2s silence.
    * Short verbal answer: 1-3 words, >= 2.5s duration, 3.5s grace silence.
    * Acoustic fallback: >= 1.5s cumulative vocal energy, 3.0s silence (even if browser STT drops words).
* **State Machine & Lifecycle Guards**: [`frontend/src/pages/LiveInterviewPage.jsx`](file:///C:/Workspace/Workspace/InterviewApp/frontend/src/pages/LiveInterviewPage.jsx)
  * Deterministic Lifecycle: Decoupled TTS from effect cleanups to ensure initial greeting is audibly spoken and Question 2+ microphones never die.
  * Centralized AI Speech States (`isAISpeakingState`): Barge-in active across Questions, Greetings, Greeting Acks, Transition Bridges, Repeat Acks, Clarifications, and Closings.
  * Speech Generation ID (`speechGenerationIdRef`): Ensures cancelled/interrupted speech never executes old `.then()` state transition callbacks.
  * Lock Safety: `try ... finally` guarantees `isUploadingRef` and `transitionLockRef` never deadlock.

---

## 2. Environment Preparation

- [ ] Physical machine (Laptop / Lab PC) with working microphone and speakers.
- [ ] Google Chrome (latest) or Microsoft Edge with microphone & camera permissions granted.
- [ ] Normal room environment (ceiling fan, laptop cooling fan, or typical ambient background sound).
- [ ] Backend stack running:
  - Backend API on port `5000` (`npm run dev` in `backend/`)
  - NLP Service on port `8003` / `5001` (`python -u main.py` in `ai-services/nlp-service/`)
  - Voice Service on port `8002` (if Kokoro TTS enabled)
  - Frontend on port `5173` (`npm run dev` in `frontend/`)

---

## 3. Physical Test Protocol

| Test ID | Test Scenario | Step-by-Step Action | Expected Behavior | Pass / Fail |
|---|---|---|---|---|
| **Test 1** | **Initial Welcome Greeting Delivery** | Start the interview. Do not click anything. Listen. | Full initial welcome greeting is audibly spoken by AI. System then transitions into listening. | `[ ] PASS / [ ] FAIL` |
| **Test 2** | **Greeting Acknowledgement & Q1 Transition** | After greeting, speak *"Hello, I am ready."* (or wait 4.5s). | AI speaks acknowledgement (*"Wonderful! Let's get started..."*) and Question 1 begins. | `[ ] PASS / [ ] FAIL` |
| **Test 3** | **Question 1 Answer & Auto-Advance** | Speak an answer to Question 1, then pause for 2.2s. | Speaking visualizer pulses. Turn auto-completes. Transition phrase plays. | `[ ] PASS / [ ] FAIL` |
| **Test 4** | **Question 2 Microphone & VAD Persistence** | When Question 2 plays, answer naturally. | **Speaking visualizer active on Question 2**. VAD tracks speech. Turn auto-completes. Transition to Q3 works seamlessly! | `[ ] PASS / [ ] FAIL` |
| **Test 5** | **Question 3+ Multi-Question Continuity** | Answer Question 3, Question 4, and beyond. | Microphone/VAD/STT remains 100% active and healthy across every single consecutive question. | `[ ] PASS / [ ] FAIL` |
| **Test 6** | **Ambient Noise Rejection** | Stay completely silent during AI question reading with fan on. | AI speaks the entire question smoothly without false interruption. | `[ ] PASS / [ ] FAIL` |
| **Test 7** | **Voice Repeat Request** | Say: *"Can you repeat the question please?"* | AI acknowledges and repeats the current question without advancing index. | `[ ] PASS / [ ] FAIL` |
| **Test 8** | **Voice Clarification Request** | Ask: *"What do you mean by ACID compliance?"* | AI delivers a brief 1-2 sentence clarification and resumes listening. | `[ ] PASS / [ ] FAIL` |
| **Test 9** | **Mid-Question Barge-In** | Interrupt Question TTS mid-sentence with direct answer. | AI stops instantly; opening words are preserved in transcript. | `[ ] PASS / [ ] FAIL` |
| **Test 10** | **Natural Closing & Teardown** | Complete final question. | AI delivers closing statement. Media tracks close. Navigates to report. | `[ ] PASS / [ ] FAIL` |

---

## 4. Physical Test Sign-Off

* **Tester Name / ID**: ___________________________
* **Date & Time Tested**: ___________________________
* **Device / Microphone**: ___________________________
* **Browser Version**: ___________________________
* **Overall Physical Result (All Tests 1-10 Passed)**: `[ ] PASS  /  [ ] FAIL`
* **Observed Notes / Acoustic Remarks**: ___________________________
