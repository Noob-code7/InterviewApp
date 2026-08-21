# CONTINUOUS CONVERSATIONAL INTERVIEW FLOW — MASTER ARCHITECTURE & PHASE DOCUMENTATION

This document provides a comprehensive, phase-by-phase record of the engineering motive, technical plan, implementation execution, testing methodology, and empirical verification reports for the **Continuous Conversational AI Interview Flow** implemented in **InterviewApp**.

---

## EXECUTIVE SYSTEM OVERVIEW

The goal of this initiative was to eliminate manual button dependencies ("Next Question", manual recording start/stop) and elevate InterviewApp to a **natural, continuous, conversational AI interview partner**.

```text
                                  LIFECYCLE STATE MACHINE
                                  
  ┌─────────────────┐     ┌───────────────────┐     ┌───────────────────┐     ┌──────────────────┐
  │   INITIALIZING  ├────►│ GREETING_SPEAKING ├────►│ GREETING_LISTENING├────►│   GREETING_ACK   │
  └─────────────────┘     └───────────────────┘     └───────────────────┘     └─────────┬────────┘
                                                                                        │
  ┌─────────────────┐     ┌───────────────────┐     ┌───────────────────┐               │
  │    COMPLETED    │◄────┤  CLOSING_SPEAKING │◄────┤PROCESSING_ANSWER  │◄──────────────┘
  └─────────────────┘     └─────────▲─────────┘     └─────────▲─────────┘
                                    │                         │
                                    │               ┌─────────┴─────────┐
                                    │               │TRANSITION_SPEAKING│
                                    │               └─────────▲─────────┘
                                    │                         │
                                    │               ┌─────────┴─────────┐
                                    ├───────────────┤    AI_SPEAKING    │◄──────────────┐
                                    │               └─────────┬─────────┘               │
                                    │                         │ (Speak / Barge-in)      │
                                    │                         ▼                         │
                                    │               ┌───────────────────┐               │
                                    │               │     LISTENING     ├───────────────┤
                                    │               └─────────┬─────────┘               │
                                    │                         │                         │
                                    │        ┌────────────────┼────────────────┐        │
                                    │        │ (Repeat)       │ (Clarify)      │        │
                                    │        ▼                ▼                │        │
                                    │  ┌───────────┐   ┌──────────────┐        │        │
                                    │  │ REPEAT_ACK│   │ CLARIFICATION│────────┴────────┘
                                    │  └───────────┘   └──────────────┘
```

---

## VERIFICATION STATUS LEGEND

> **Honesty policy:** statuses below are assigned strictly by the type of evidence actually
> produced. Python re-implementations under `scratch/*.py` are **Simulated Synthetic
> Benchmarks**: they model the algorithms with synthetic data and do **not** execute the real
> application, so any numbers they print are **not** empirical measurements of the system.
> Authoritative evidence comes from the real test scripts under `backend/scripts/` and the
> lab-PC manual checklist (`LAB_PC_VAD_BARGEIN_VERIFICATION_CHECKLIST.md`).

| Status | Meaning |
|---|---|
| `VERIFIED` | Proven by executing the real application/real code path (API + services + build) and observing the expected outcome. |
| `PARTIALLY VERIFIED` | Some real paths proven (e.g., API-level e2e or real classifier import), but part of the claim is not empirically exercised (e.g., browser UI, real mic/audio). |
| `NOT VERIFIED (simulated only)` | Evidence comes only from a synthetic Python re-implementation / simulated benchmark; the real system behavior was not empirically measured. |
| `FAILED` | A real run produced a failing outcome. |
| `NOT VERIFIED` | No evidence produced yet. |

---

## PHASE 0 — Baseline & Architecture Audit

### 1. Motive
Before implementing continuous conversational automation, we must trace and preserve all existing working pipelines (Whisper STT, SER Voice Emotion, DeepFace Vision, Local NLP scoring, OpenRouter LLM Project Question generation, and Report generation) so that no working functionality is regression-broken.

### 2. Plan
- Audit `LiveInterviewPage.jsx`, `sessionController.js`, `answerController.js`, `llmRouter.js`, and `nlpService.py`.
- Establish baseline regression benchmarks (`testResumeFlow.js` and `verify_5_sessions_e2e.js`) to verify end-to-end multi-track data processing prior to any state machine changes.

### 3. Execution
- Identified existing TTS (`window.speechSynthesis`), recording (`MediaRecorder`), live transcript (`SpeechRecognition`), and report navigation handlers.
- Confirmed audio/video Blob generation schema (`video/webm`) and backend multipart form data handling (`uploadAnswer`).

### 4. Testing
- Executed `scripts/testResumeFlow.js` for resume-based interview generation (HR, Subject, and Project tracks).
- Executed 5-session multi-topic pipeline test.

### 5. Report
- **Status**: `VERIFIED`
- **Result**: Real baseline regressions pass — `testResumeFlow.js` (multi-track resume
  interview, HR/Subject/Project) and `verify_5_sessions_e2e.js` (5-session multi-topic
  pipeline) complete with scorecards intact.

---

## PHASE 1 — Remove Manual 'Next Question' Dependency

### 1. Motive
In traditional interview tools, candidates must manually click a "Next Question" button after answering every question. This breaks conversational immersion and creates artificial friction.

### 2. Plan
- Refactor `LiveInterviewPage.jsx` around a single-owner state machine (`INTERVIEW_STATES`).
- Automatically trigger answer completion, recording finalization, upload, and question advancement as soon as the candidate finishes speaking.
- Add concurrency and duplicate transition guards (`isAdvancingRef`, `isUploadingRef`) to block double-submissions.

### 3. Execution
- Created `INTERVIEW_STATES` enum (`INITIALIZING`, `AI_SPEAKING`, `LISTENING`, `PROCESSING_ANSWER`, `ADVANCING`, `COMPLETED`).
- Bound `triggerAnswerCompletion(source)` as the sole entry point for answer upload and progression.
- Removed manual button requirements while preserving optional fallback controls.

### 4. Testing
- Created `scratch/verify_phase1_py.py` (Simulated Synthetic Benchmark) submitting dummy video
  blobs through the backend API for 1-, 3-, and 5-question sessions. It verifies **API-level**
  answer storage, not the browser auto-advance UI.
- The browser-side auto-advance path (`triggerAnswerCompletion` → state machine) is not
  exercised by any automated test in this environment; it requires a real browser session.

### 5. Report
- **Status**: `PARTIALLY VERIFIED`
- **Result**: API-level session creation/answering confirmed for 1, 3, and 5 questions. The
  UI auto-advance claim (no manual button, zero race conditions) is **not** empirically
  verified in a browser; see the Lab-PC checklist.

---

## PHASE 2 — Reliable Answer Completion Detection

### 1. Motive
Simple timers or naive silence thresholds cut off candidates prematurely when they pause to think mid-sentence. We need an intelligent, acoustic-and-textual Voice Activity Detector (VAD) that distinguishes natural thinking pauses from genuine answer completion.

### 2. Plan
- Build `useVoiceActivityDetector.js` using Web Audio API `AudioContext` and `AnalyserNode` to track Root-Mean-Square (RMS) amplitude.
- Dual-signal completion criteria:
  - **Standard Answer**: RMS energy below threshold (`0.025`) for `2200ms` AND Web Speech API transcript stable for `2200ms` (minimum 4 words, 3s duration).
  - **Short Answer / Thinking Pause**: Extended grace period of `4000ms` before cutting off short answers (1-3 words) or initial silence.

### 3. Execution
- Implemented `frontend/src/hooks/useVoiceActivityDetector.js`.
- Integrated VAD hook into `LiveInterviewPage.jsx`, feeding real-time audio stream and live speech recognition text updates.

### 4. Testing
- Created `scratch/test_phase2_vad_sim.py` (**Simulated Synthetic Benchmark**) — a Python
  re-implementation of the VAD completion rules fed synthetic audio frames: 
  1. Continuous speaking → No premature cutoff.
  2. Natural 1.5s mid-sentence pause → Maintained active recording.
  3. Filler words ("um", "uh") → Maintained active recording.
  4. Short answer ("Yes, indexing") → Completed after 4000ms grace period.
  5. Genuine completion → Triggered auto-advancement after 2200ms silence.
- The real `useVoiceActivityDetector.js` (Web Audio `AnalyserNode` RMS + Web Speech) has **not**
  been empirically measured on real microphone input in this environment.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: The synthetic model passed 5/5 profiles with 0 false cutoffs / 0 missed
  completions. This validates the *design rules* only; the real hook requires real-audio
  verification (Lab-PC checklist, Test 1–3).

---

## PHASE 3 — Natural Interview Introduction

### 1. Motive
Interviews should start with a natural, welcoming AI introduction rather than immediately jumping into Question 1 cold.

### 2. Plan
- Create phrased greeting and acknowledgement banks in `interviewConversationalPatterns.js`.
- Add `GREETING_SPEAKING`, `GREETING_LISTENING`, and `GREETING_ACK` states to `LiveInterviewPage.jsx`.
- On initial page load, AI welcomes candidate → listens for candidate greeting response (or 4.5s grace period) → speaks brief acknowledgement → transitions smoothly to Question 1.
- Ensure greeting audio and transcripts are 100% isolated from Question 1 scoring.

### 3. Execution
- Created `frontend/src/utils/interviewConversationalPatterns.js` containing `INTERVIEW_GREETINGS` (10 items) and `GREETING_ACKNOWLEDGEMENTS` (5 items).
- Integrated pre-Q1 greeting lifecycle into `LiveInterviewPage.jsx`.

### 4. Testing
- Created `scratch/test_phase3_greetings.py` (**Simulated Synthetic Benchmark**) — uses a copied
  greeting array and `random.choice`; it does not execute the real
  `interviewConversationalPatterns.js` or the browser greeting lifecycle.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: The synthetic run observed 7 distinct greetings across 10 starts and asserted
  isolation of the sample greeting text from sample Q1 payloads. Real greeting behavior in the
  browser is not empirically verified.

---

## PHASE 4 — Automatic Question Transition

### 1. Motive
Moving abruptly between questions feels robotic. The AI should speak short, natural transition bridges (*"Got it. Let me move on to the next question."*) with natural pauses.

### 2. Plan
- Add `TRANSITION_SPEAKING` state to `LiveInterviewPage.jsx`.
- Select transition phrase from `QUESTION_TRANSITIONS` bank.
- Speak transition phrase via TTS → introduce natural `0.5s` pause → advance question index → speak next question.
- Guard against race conditions, slow uploads, rapid VAD firings, and re-renders. Skip transition phrase on final question.

### 3. Execution
- Implemented `executeQuestionTransition(nextIndex)` in `LiveInterviewPage.jsx`.
- Added `transitionLockRef` and `lastSpokenTransitionIndexRef` guards.

### 4. Testing
- Created `scratch/test_phase4_transitions_lifecycle.py` (**Simulated Synthetic Benchmark**) — a
  Python model of the transition rules; it does not execute the real
  `executeQuestionTransition` / `transitionLockRef` code or a browser.
  9 lifecycle scenarios were modelled:
  1. Normal answer → exactly 1 next question.
  2. Long answer → exactly 1 next question.
  3. Short answer → exactly 1 next question.
  4. Follow-up answer → exactly 1 follow-up/next question.
  5. Final answer → closing (no extra question).
  6. Slow network/upload → lock held until upload resolves.
  7. Rapid VAD callbacks → 1 transition execution.
  8. Re-render during transition → 0 duplicate TTS.
  9. 10 consecutive questions → exactly 9 transitions.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: The synthetic model passed all 9 scenarios with 0 duplicate transitions. The real
  frontend transition logic is not empirically verified in a browser.

---

## PHASE 5 — Barge-In / Candidate Interruption

### 1. Motive
Candidates must be able to interrupt the AI at any moment while it is speaking a question, just like in a real human conversation.

### 2. Plan
- Enable VAD acoustic monitoring (`bargeInEnabled = true`) during `AI_SPEAKING` and `GREETING_SPEAKING`.
- Set elevated noise gate threshold (`0.038 RMS`) and sustained duration filter (`120ms`) to reject speaker acoustic bleed and background clicks.
- When candidate speaks during TTS: execute `window.speechSynthesis.cancel()`, record full pipeline latency (speech onset → TTS cancel), set state to `LISTENING`, and start candidate recording.

### 3. Execution
- Enhanced `useVoiceActivityDetector.js` with onset timestamp tracking (`bargeInOnsetRef`) and `onBargeIn` callback.
- Updated `LiveInterviewPage.jsx` to handle barge-in interruptions and compute end-to-end latency.

### 4. Testing
- Created `scratch/test_phase5_full_pipeline_benchmark.py` (**Simulated Synthetic Benchmark**).
  Latency values are produced by `random.uniform` and `statistics.median` inside the Python
  simulator; they are **not** measurements of the real `useVoiceActivityDetector.js` /
  `window.speechSynthesis.cancel()` path. No browser/audio hardware was used.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result** (synthetic benchmark only, do NOT cite as real measurements):
  - **Median "Full Pipeline Latency"**: `143.82 ms` (simulated)
  - **P95 "Full Pipeline Latency"**: `148.91 ms` (simulated; the `random.uniform` model
    was constructed to stay under the `150 ms` target)
  - **False Positive Count**: `0` (simulated acoustic-bleed frames in the model)
  - **Missed Interruption Count**: `0` (simulated trials)
- **Real verification deferred**: barge-in latency, echo rejection, and interruption capture
  on real hardware are specified in `LAB_PC_VAD_BARGEIN_VERIFICATION_CHECKLIST.md`
  (Tests 4–6).

---

## PHASE 6 — Interruption Intent Classification

### 1. Motive
When a candidate interrupts the AI, we must determine *why* they interrupted (e.g., asking to repeat, asking for clarification, giving an answer, or asking to wait) so the system responds appropriately without calling an expensive LLM every time.

### 2. Plan
- Implement a lightweight, deterministic local pattern classifier `classifyInterruption(text)` in `interviewConversationalPatterns.js`.
- Classify into 6 intent classes: `REPEAT_REQUEST`, `CLARIFICATION_REQUEST`, `ACKNOWLEDGEMENT`, `ANSWER`, `GENERAL_INTERRUPTION`, `UNKNOWN`.

### 3. Execution
- Implemented regex and keyword pattern matching in `frontend/src/utils/interviewConversationalPatterns.js`.

### 4. Testing
- **Authoritative (real)**: `backend/scripts/test_phase6_intent_classifier.mjs` imports the real
  `classifyInterruption` from `interviewConversationalPatterns.js` and asserts **25/25** test
  utterances (PASSES in this environment).
- Legacy `scratch/test_phase6_intent_dataset.py` (**Simulated Synthetic Benchmark**) modelled
  the classifier in Python with a copied 42-utterance dataset; it does not exercise the real
  module.

### 5. Report
- **Status**: `PARTIALLY VERIFIED`
- **Result**: Real classifier verified **25/25** against the actual `classifyInterruption`
  implementation. The **42/42** figure is from the simulated Python dataset (not the real
  module); the real dataset covers 25 cases. `$< 1ms` execution latency was measured only in
  the simulation, not in the browser.

---

## PHASE 7 — Repeat Question Handling

### 1. Motive
When a candidate asks "Can you repeat the question?", the system should re-read the question naturally without advancing the question index or treating the candidate's query as an answer.

### 2. Plan
- Add `REPEAT_ACK_SPEAKING` state to `LiveInterviewPage.jsx`.
- When `REPEAT_REQUEST` is detected:
  - Discard recorded audio chunks and interim transcript.
  - Speak a varied repeat acknowledgement (*"Sure, let me repeat that for you."*).
  - Replay TTS for the exact same question index (`currentQuestionIndex`).
  - Resume candidate listening.

### 3. Execution
- Implemented `handleRepeatQuestion()` in `LiveInterviewPage.jsx`.

### 4. Testing
- Created `scratch/test_phase7_repeat_flow.py` (**Simulated Synthetic Benchmark**) — a Python
  model with copied assertions; it does not run the real `handleRepeatQuestion()` or browser.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: Synthetic model asserted index-fixed behavior and 3 clean cards. Real repeat
  handling in the browser is not empirically verified.

---

## PHASE 8 — Clarification Request Handling

### 1. Motive
When a candidate asks for clarification (e.g., "What do you mean by ACID compliance?"), the AI should provide a crisp explanation without skipping the question or scoring the candidate's inquiry as their answer.

### 2. Plan
- Add `CLARIFICATION_SPEAKING` state to `LiveInterviewPage.jsx`.
- Implement `generateClarificationResponse(questionText, candidateQuery)` in `interviewConversationalPatterns.js` providing concise (1-2 sentence) domain explanations for DBMS, OS, OOP, Scaling, and Architecture queries.
- Discard query audio → speak clarification via TTS → resume candidate listening for the actual answer.

### 3. Execution
- Added clarification generator and integrated `handleClarificationRequest()` into `LiveInterviewPage.jsx`.

### 4. Testing
- Created `scratch/test_phase8_clarification_flow.py` (**Simulated Synthetic Benchmark**) — a
  Python model using a copied clarification snippet; it does not run the real
  `generateClarificationResponse` / `handleClarificationRequest`.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: Synthetic model asserted <= 2 sentences. Real clarification generation and
  scoring behavior in the browser is not empirically verified.

---

## PHASE 9 — Mid-Question Answer Handling

### 1. Motive
When a candidate knows the answer immediately and starts answering while the AI is mid-sentence, the system must capture their opening words seamlessly without clipping or audio loss.

### 2. Plan
- In `handleBargeInInterruption`, if the candidate starts answering directly, capture interim recognized text (`initialText`).
- Pass `initialText` into `handleStartRecording(initialText)` so `liveTranscript` is pre-populated and `MediaRecorder` continuously records remaining audio frames.
- Attribute answer to the exact question being spoken.

### 3. Execution
- Updated `handleBargeInInterruption` and `handleStartRecording` in `LiveInterviewPage.jsx`.

### 4. Testing
- Created `scratch/test_phase9_midquestion_flow.py` (**Simulated Synthetic Benchmark**) — a
  Python model asserting string-preservation on hard-coded samples; it does not run the real
  `handleBargeInInterruption` / `handleStartRecording` media-recorder path.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: Synthetic model asserted opening-word preservation on fixed strings. Real
  barge-in mid-question capture with audio is not empirically verified.

---

## PHASE 10 — Natural Interview Closing

### 1. Motive
When the interview finishes, the AI should deliver a warm, natural closing statement, cleanly release hardware camera/microphone resources, and transition to report processing.

### 2. Plan
- Add `CLOSING_SPEAKING` state to `LiveInterviewPage.jsx`.
- Upon completing final question ($N$-th question) and follow-ups:
  - Select random closing statement from `CLOSING_STATEMENTS`.
  - Speak closing phrase via TTS.
  - Call `stopCamera()` to release hardware streams.
  - Update session status to `processing` and navigate to `/processing/:sessionId`.

### 3. Execution
- Implemented `executeNaturalClosing()` and hardware track release in `LiveInterviewPage.jsx`.

### 4. Testing
- Created `scratch/test_phase10_closing_suite.py` (**Simulated Synthetic Benchmark**) — a Python
  model cycling a copied `CLOSING_STATEMENTS` array; it does not run the real
  `executeNaturalClosing()` or the camera/mic hardware release.

### 5. Report
- **Status**: `NOT VERIFIED (simulated only)`
- **Result**: Synthetic model asserted >= 2 distinct closings. Real closing TTS + hardware
  teardown in a browser is not empirically verified.

---

## PHASE 11 — Comprehensive End-to-End Conversational Test Scenarios (A through H)

### 1. Motive
Validate all 8 end-to-end candidate interview journeys across clean paths, interruptions, repeats, clarifications, short answers, long answers, thinking pauses, and combined complex flows.

### 2. Plan & Execution
Build `scratch/test_phase11_scenarios_e2e.py` (**Simulated Synthetic Benchmark**) executing
modeled scenario journeys via dummy API answers:
- **Scenario A**: Clean Path (Greeting → Q1 → Q2 → Q3 → Closing).
- **Scenario B**: Mid-Question Interruption & Answer.
- **Scenario C**: Repeat Request Handling.
- **Scenario D**: Clarification Request Handling.
- **Scenario E**: Very Short Answer (< 4 words, 4s grace period).
- **Scenario F**: Long Answer with 1.5s Mid-Sentence Pauses.
- **Scenario G**: Long Initial Thinking Pause (3.5s).
- **Scenario H**: Combined Complex Journey (Greeting + Interruption + Repeat + Clarification + Short + Long + Closing).

> **Authoritative (real) alternative**: `backend/scripts/test_phase11_scenarios_e2e.mjs` drives
> the same 8 scenarios (A–H) against the **live backend + NLP + voice + face services** with
> real REST calls and asserts each scenario completes. It **PASSES 8/8** in this environment
> (result below is from the real JS runner).

### 3. Testing & Report
```text
=======================================================================
RUNNING PHASE 11 COMPREHENSIVE END-TO-END CONVERSATIONAL SCENARIOS (A-H)
=======================================================================

[SCENARIO A] Clean Path: Greeting -> Q1 -> Q2 -> Q3 -> Closing           -> [PASS]
[SCENARIO B] Mid-Question Interruption & Direct Answer                    -> [PASS]
[SCENARIO C] Repeat Request Handling                                      -> [PASS]
[SCENARIO D] Clarification Request Handling                                -> [PASS]
[SCENARIO E] Very Short Answer (Thinking Grace Period)                    -> [PASS]
[SCENARIO F] Long Detailed Answer with Natural 1.5s Pauses                -> [PASS]
[SCENARIO G] Long Initial Thinking Pause Before Speech Onset              -> [PASS]
[SCENARIO H] Combined Complex Journey (All Features)                      -> [PASS]

=======================================================================
ALL 8 SCENARIOS (A THROUGH H) PASSED WITH 100% SUCCESS!
=======================================================================
```
- **Status**: `PARTIALLY VERIFIED`
- **Note**: 8/8 scenarios verified against real services via the API runner
  (`test_phase11_scenarios_e2e.mjs`). The browser-level conversational journey (greeting
  TTS, live VAD, barge-in, repeat/clarify UI) is not exercised by this API runner; see the
  Lab-PC checklist.

---

## PHASE 12 — Final Regressions & Comprehensive System Health Check

### 1. Motive
Ensure full backward compatibility across all backend pipelines (Resume Multi-Track, SER Voice Emotion, DeepFace Vision, NLP Scoring, Report Generation) and verify production compilation.

### 2. Plan & Execution
- Run `node scripts/testResumeFlow.js` for multi-track resume interview generation (HR, Subject, and LLM Project tracks). **PASSES** in this environment.
- Run 5-session multi-topic pipeline test — `backend/scripts/verify_5_sessions_e2e.js`
  (**real** JS runner). **PASSES** in this environment (15 project questions across 5
  sessions, 9 distinct).
- Run transcript mapping regression (`backend/scripts/testTranscriptMapping.js`). **PASSES 4/4**.
- Run score parity / storage resolution test (`backend/scripts/verify_parity_test.js`).
  **PASSES** (Overall 70/100; local media resolution path exercised for real).
- Run production bundle build (`npm run build` in `frontend/`). **PASSES** (0 errors).

### 3. Testing & Report
```text
===============================================================
🧪 RUNNING RESUME MULTI-TRACK INTERVIEW & FOLLOW-UP TEST
===============================================================
Report received. Total question cards: 5
✅ RESUME MULTI-TRACK INTERVIEW & FOLLOW-UP TEST PASSED WITH 100% ACCURACY!

===============================================================
🧪 VERIFYING 5 CONSECUTIVE SESSIONS WITH CONTINUOUS FLOW PIPELINE
===============================================================
✅ ALL 5 SESSIONS COMPLETED AND VERIFIED WITH 100% SUCCESS!

> vite build
✓ built in 606ms (0 errors)
```
- **Status**: `VERIFIED`

---

## SUMMARY SCORECARD TABLE

| Phase | Title | Code Base Target | Verification Status |
|---|---|---|---|
| **Phase 0** | Baseline & Architecture Audit | Full Application Pipeline | `VERIFIED` |
| **Phase 1** | Remove Manual 'Next Question' Dependency | `LiveInterviewPage.jsx` | `PARTIALLY VERIFIED` |
| **Phase 2** | Reliable Answer Completion Detection | `useVoiceActivityDetector.js` | `NOT VERIFIED (simulated only)` |
| **Phase 3** | Natural Interview Introduction | `interviewConversationalPatterns.js` | `NOT VERIFIED (simulated only)` |
| **Phase 4** | Automatic Question Transition | `LiveInterviewPage.jsx` | `NOT VERIFIED (simulated only)` |
| **Phase 5** | Barge-In / Candidate Interruption | `useVoiceActivityDetector.js` | `NOT VERIFIED (simulated only)` |
| **Phase 6** | Interruption Intent Classification | `interviewConversationalPatterns.js` | `PARTIALLY VERIFIED` (real classifier 25/25) |
| **Phase 7** | Repeat Question Handling | `LiveInterviewPage.jsx` | `NOT VERIFIED (simulated only)` |
| **Phase 8** | Clarification Request Handling | `LiveInterviewPage.jsx` | `NOT VERIFIED (simulated only)` |
| **Phase 9** | Mid-Question Answer Handling | `LiveInterviewPage.jsx` | `NOT VERIFIED (simulated only)` |
| **Phase 10** | Natural Interview Closing | `LiveInterviewPage.jsx` | `NOT VERIFIED (simulated only)` |
| **Phase 11** | End-to-End Scenarios (A–H) | Full Flow | `PARTIALLY VERIFIED` (real API e2e 8/8) |
| **Phase 12** | Final Regressions & Build Health | System Build & Multi-Track | `VERIFIED` |

> **Correction note:** earlier revisions of this document labelled all phases `VERIFIED
> (100% Pass)` based on the Python `scratch/*.py` simulations. Those scripts are **Simulated
> Synthetic Benchmarks** and have been relabeled accordingly. Real evidence statuses are as
> shown above; the browser conversational behaviors (Phases 2–5, 7–10) await
> `LAB_PC_VAD_BARGEIN_VERIFICATION_CHECKLIST.md` execution on a lab PC.

