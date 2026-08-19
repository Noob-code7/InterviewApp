InterviewApp — Complete Project Summary
Project Overview
Repository: https://github.com/Noob-code7/InterviewApp.git (branch: Interview-setup)
Architecture: Microservices — 7 services + MongoDB + frontend

- Backend API (5000) — Express + MongoDB
- Face Service (8001) — DeepFace emotion/posture
- Voice Service (8002) — PyTorch SER + Faster-Whisper STT
- NLP Service (8003) — LLM evaluation (OpenRouter)
- Question Service (8004) — STUB (placeholder questions)
- Report Service (8005) — STUB (hardcoded 82.0)
- Frontend (5173) — React + Vite
  ✅ COMPLETED WORK (Chronological)

1. Core Platform Build (Commits: 4b95e83, 0e2e5b4)

- Full microservices scaffold with Docker Compose
- Backend: Auth (JWT), Sessions, Questions, Answers, Reports, Storage
- Frontend: LiveInterviewPage, ProcessingPage, Report page
- AI Services: Face, Voice (SER+STT), NLP, Question, Report
- Question banks (HR + Technical by role), seed scripts
- SER model auto-download from GitHub Release v1.0-ser-model (362MB, SHA256 verified)

2. Qwen Local SLM Removal (User Decision: "remove local qwen entirely, rely on OpenRouter")

- git rm -f ai-services/nlp-service/cse_evaluator.py (staged)
- Deleted ai-services/nlp-service/models/ (~1.07GB GGUF freed)
- .gitignore += ai-services/nlp-service/models/
- No local models remain

3. LLM Rewire — OpenRouter Only

- Removed: OpenAI, Anthropic dependencies & code paths
- Removed: Gemini (user's free key exhausted after ~2 requests)
- nlp-service/main.py rewritten:
- Single provider: OpenRouter (https://openrouter.ai/api/v1/chat/completions)
- OPENROUTER_API_KEY required; LLM_MODEL configurable (default: nvidia/nemotron-3-super-120b-a12b:free)
- 429 retry/backoff honoring Retry-After (3 attempts)
- parse_llm_json robust extraction (handles markdown fences, extra text)
- /analyze order: LLM → local heuristics fallback
- /health returns has_llm_key: true
- asyncio import added
- requirements.txt: Added httpx==0.27.2, removed openai, anthropic
- .env.example: Documented free-model roster
- Verification: /analyze → 9.1s, real LLM score (overallScore 90, specific feedback)

4. Media Auto-Delete Feature (Privacy-by-Design)

- Requirement: "local storage, delete instantly after analysis & scoring complete"
- Implementation:
- backend/services/analysisService.js: deleteSessionMedia(sessionId) — deletes answer video/audio + reference image from disk, clears DB refs only on success, sets session.mediaDeleted = true
- Called at end of processSession success path
- Escape hatch: KEEP_MEDIA_AFTER_ANALYSIS=true (documented in backend/.env.example)
- Session.js: Added mediaDeleted: {type: Boolean, default: false}
- Testing: 14/14 assertions pass (delete, idempotency, keep-mode, missing-file)

5. Full E2E Verification (Node Script)

- All 7 services UP (ports verified)
- Voice: ser_model_loaded: true, stt_model_loaded: true
- NLP: has_llm_key: true (OpenRouter key configured)
- Complete flow tested: Register → Session → Questions (real DB bank) → Answer Upload → startAnalysis (batch) → Report
- Result: Pipeline executes in ~5s for 3 answers; media deletion confirmed (mediaDeleted: true, 0 remaining files)
- Scores 0 — artifact of test media (440Hz tone wav, not real speech/video)

6. OpenRouter Key Configured

- User provided key (sk-or-v1-...) — ⚠️ ROTATED / REVOKED on 18 Aug 2026 after exposure in chat. New key must be generated at https://openrouter.ai/settings/keys and pasted into ai-services/nlp-service/.env
- Written to ai-services/nlp-service/.env (gitignored)
- Advised: Rotate key (shared in chat)
  🔍 CURRENT STATE — What Works / What Doesn't
  Component Status Notes
  Backend API ✅ Working Auth, sessions, questions, answers, reports, storage
  Face Service ✅ Working DeepFace cached; processes video (loose detection on blanks)
  Voice Service ✅ Working SER + STT models loaded; real emotion probs
  NLP Service ✅ Working OpenRouter LLM verified; fallback heuristics
  Question Service (8004) ⚠️ STUB Placeholder questions; NOT used by app (backend uses DB bank + resume synthesis)
  Report Service (8005) ⚠️ STUB Hardcoded 82.0; NOT used by app (backend reportController does real aggregation)
  Frontend ✅ Serving LiveInterviewPage, ProcessingPage functional
  Redis/BullMQ ⚠️ Unused Redis closed; processSession uses setTimeout directly
  Batch Analysis (startAnalysis) ⚠️ Partial Only runs Face + Voice; NLP NOT executed in batch path
  Per-Answer NLP ✅ Working POST /api/analysis/voice (called by LiveInterviewPage) does STT → NLP → persists
  Media Cleanup ✅ Working Deletes after batch analysis completes
  Question Generation ✅ Working DB bank + hardcoded fallback + resume synthesis via NLP
  Report Generation ✅ Working Backend reportController real aggregator (weights: NLP 35%, Voice 30%, Face 25%, Writing 10%)
  Critical Gap Found
  Batch analysis (POST /api/analysis/:id/start) does NOT run NLP scoring. Only Face + Voice.
- NLP scoring ONLY happens via per-answer POST /api/analysis/voice (live flow)
- If user skips live recording and only hits "Analyze", NLP score = 0
- Frontend flow: LiveInterviewPage calls /api/analysis/voice after each answer → NLP runs. ProcessingPage calls /api/analysis/:id/start → Face+Voice only.
  📋 REMAINING WORK (Prioritized)
  P0 — Immediate / Blocking

1. Fix Batch NLP Gap — Add NLP evaluation to processSession for answers missing nlpAnalysis (reuse sendTextToAnalyzer pattern). Ensures "Analyze" button produces complete report.
   P1 — Option A: Self-Host Handover Kit (User: "complete Qwen/LLM first, then Option A")
   Planned, not implemented

- Docker Compose: Named volumes (backend-uploads, deepface-cache → /root/.deepface, hf-cache → /root/.cache/huggingface)
- Frontend: ARG VITE_API_URL + nginx TLS (443) + proxy /api & /uploads → backend:5000
- setup.sh: Install Docker, prompt CAMPUS_HOST + OpenRouter key, write all 8 .env files, optional --import-bundle, docker compose up -d --build, health checks
- scripts/bundle_models.sh: Bundle SER model + DeepFace weights + HF cache for offline USB install
- HANDOVER.md: Runbook (HTTPS options: Caddy/Let's Encrypt vs self-signed, mongodump cron, admin/faculty creation, firewall 443-only, 200-student capacity notes)
- backend/scripts/seedAdmin.js: Idempotent admin user creation
- Open Questions: HTTPS cert source (Caddy vs manual), college OS (assume Ubuntu), admin seeding flow
  P2 — Adaptive AI Interviewing Feature (Approved Design, Not Started)
  Original approved plan — deferred per user
- Backend: adaptiveInterviewService.js — follow-up decision engine (LLM + heuristics)
- NLP Service: POST /adaptive/decide — context-aware follow-up generation
- Session Model: Answer schema → isFollowUp, parentQuestionId, followUpQuestion, adaptiveDecision
- Controllers: analysisController embed decision in transcribeAndEvaluate; answerController accepts follow-up fields
- Frontend: LiveInterviewPage.jsx — activeFollowUp state; interview.js upload body includes follow-up fields
- Defaults: MAX_FOLLOWUPS_PER_INTERVIEW=4, MAX_FOLLOWUPS_PER_PRIMARY_QUESTION=1, ADAPTIVE_INTERVIEW_ENABLED=true
- Fallback: Grammar heuristic (zero deps) if LLM fails
  P3 — Scaling & Production Hardening
- 200 Concurrent Students: Free tiers insufficient (OpenRouter 20 RPM / 50 req/day fresh; voice+face on single CPU box)
- Options: Paid API (~$0.5–2.5/drive), GPU/local inference, or accept sequential processing
- Face Service Quality: Loose detection counts blank frames as faces → tighten threshold
- Render/Vercel: Demo-grade only (ephemeral disk, 15-min sleep, 512MB RAM) — not for college deployment
- Redis: Add if BullMQ reintroduced; currently unused
  P4 — Cleanup / Polish
- Commit staged changes: cse_evaluator.py deletion + all modified files (awaiting user confirmation)
- Delete/Implement stubs: Question Service (8004) & Report Service (8005) — either implement or remove from compose
- Rotate OpenRouter key (shared in chat)
- Writing test flow: Verify writingController + NLP integration works end-to-end
  📂 KEY FILES TOUCHED / CREATED
  File Purpose
  ai-services/nlp-service/main.py OpenRouter-only LLM tier (rewritten)
  ai-services/nlp-service/.env OpenRouter key (gitignored)
  ai-services/nlp-service/.env.example Free model roster + config
  ai-services/nlp-service/requirements.txt httpx added, openai/anthropic removed
  .gitignore models/ excluded
  backend/services/analysisService.js deleteSessionMedia, processSession hook
  backend/models/Session.js mediaDeleted field
  backend/.env.example
