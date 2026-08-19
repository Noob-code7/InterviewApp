# InterviewAI — Complete AI / NLP / Multimodal Health & Architecture Status

**Date**: 18 Aug 2026  
**Scope**: Full architectural status and execution health verification across all microservices and multi-track pipelines.

---

## 1. Active Architecture Map

```
Frontend (React/Vite :5173)
   │
   ▼
Backend (Express :5000, MongoDB :27017, BullMQ / In-Process Async)
   │
   ├── nlp-service   (:8003) FastAPI — OpenRouter LLM Fallback + Local Conceptual Rubrics + Resume Extraction
   ├── voice-service (:8002) FastAPI — Faster-Whisper STT + PyTorch Wav2Vec2 SER (8 emotions)
   └── face-service  (:8001) FastAPI — DeepFace Attention, Composure & Biometric Verification
```

---

## 2. Multi-Track & Follow-Up Verification Checklist

| # | Architecture Requirement | Current Code Status | Implementation Highlights |
|---|--------------------------|:-------------------:|---------------------------|
| **1** | **Follow-Up Answer Mapping** | **RESOLVED** | `answerController.js` strips `-followup-` tokens and appends follow-up recordings directly to `parentAnswer.followUps` array. |
| **2** | **Project Question Generation via LLM** | **RESOLVED** | `questionController.js` passes extracted projects to `llmService.generateProjectQuestions` for Track 3 grounded questions. |
| **3** | **NLP Execution in Batch Pipeline** | **RESOLVED** | `processSession` (`analysisService.js:267-316`) executes full NLP evaluation (Local Concept NLP for HR/Subject vs LLM for Projects & Follow-ups). |
| **4** | **Provenance Tracking (`llm` vs `local`)** | **RESOLVED** | `NLPResult` and `llm_router.py` attach `source: "llm" | "local"` and `evaluationEngine: "local_nlp" | "llm_openrouter"`. |
| **5** | **Early Stopping in LLM Probing** | **RESOLVED** | `generate_project_followup_llm` returns `"hasFollowUp": false` when the candidate's answer is already deep and leaves no technical ambiguities. |
| **6** | **$0.00 Cost Guarantee for HR & Subject Tracks** | **RESOLVED** | HR and Subject questions run 100% locally with 0 LLM API calls using cosine similarity against question + reference answer and concept rubrics. |
| **7** | **Dynamic Follow-Up UI & PDF Report** | **RESOLVED** | `ReportPage.jsx` renders nested follow-up cards with probing questions, transcripts, and evaluation breakdown under each project question. |

---

## 3. Microservice Live Health Status

- **React Frontend (`:5173`)**: `200 OK` (All emojis & mojibake removed, pure clean typography)
- **Node Backend API (`:5000`)**: `200 OK` (`BullMQ` with resilient in-process async execution)
- **NLP Service (`:8003`)**: `200 OK` (`/health` reporting `has_llm_key: true`)
- **Voice Service (`:8002`)**: `200 OK` (Faster-Whisper + PyTorch SER)
- **Face Service (`:8001`)**: `200 OK` (DeepFace biometrics & visual posture)
