# Testing & Verification Suite — InterviewAI

## 1. Overview & Verification Strategy

InterviewAI maintains an extensive suite of automated regression tests, score parity verifiers, and physical browser VAD checklists to ensure stability across both simulated pipelines and real-world acoustic environments.

---

## 2. Automated Regression Test Matrix

| Test Suite | File Path | Scope & Invariants Tested | Execution Command | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Question-Transcript Mapping** | `backend/scripts/testTranscriptMapping.js` | Validates 1, 3, 5-question interviews; verifies 0 phantom cards and 100% transcript-to-question association. | `node -r dotenv/config ./scripts/testTranscriptMapping.js` | **100% PASS** |
| **Resume Multi-Track Flow** | `backend/scripts/testResumeFlow.js` | Verifies resume PDF parsing, question generation, and report generation integrity. | `node -r dotenv/config ./scripts/testResumeFlow.js` | **100% PASS** |
| **Candidate Intent Classifier** | `backend/scripts/test_phase6_intent_classifier.mjs` | Tests 15 regex intent phrases (`ACKNOWLEDGEMENT`, `INTERRUPTION`, `ANSWER`, `UNKNOWN`). | `node -r dotenv/config ./scripts/test_phase6_intent_classifier.mjs` | **100% PASS** |
| **Score Parity & Pipeline Verifier** | `backend/scripts/verify_parity_test.js` | Validates multi-service analysis orchestration, composite weighting, and media cleanup. | `node -r dotenv/config ./scripts/verify_parity_test.js` | **100% PASS** |
| **Multi-Session End-to-End** | `backend/scripts/verify_5_sessions_e2e.js` | Executes 5 sequential sessions to verify database isolation and concurrency safety. | `node -r dotenv/config ./scripts/verify_5_sessions_e2e.js` | **100% PASS** |
| **Local NLP Strictness Benchmark** | `scratch/test_evaluation_strictness.py` | Validates 14 test cases across correct, partial, wrong, inverted, sarcastic, buzzword answers. | `python scratch/test_evaluation_strictness.py` | **100% PASS** |

---

## 3. Physical Browser / Lab Acoustic Checklist

While synthetic test scripts validate API boundaries, physical microphone testing is required to verify real-world acoustics:

- [x] **Quiet Room Verification**: Normal candidate speech triggers VAD cleanly ($RMS > 0.025$); silence for 2.2s finalizes answer automatically.
- [x] **Home Environment Noise Rejection**: Tested with traffic sounds, car horns, and typing noise. Isolated acoustic spikes without speech recognition tokens do not trigger false barge-ins.
- [x] **Candidate Interruption (Barge-In)**: Candidate speaking during AI question delivery immediately halts Kokoro TTS audio within $< 150\text{ms}$.
- [x] **Answer Continuation**: Interrupted Question $N+1$ preserves Question $N$ transcript buffer seamlessly.
