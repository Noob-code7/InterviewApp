# Requirements — Milestone 2: Production Scale & AI Intelligence

## Validated Requirements (Milestone 1)
- [x] JWT Authentication & User Profile settings (`/login`, `/register`, `/profile`)
- [x] Pre-interview setup flow (`/interview/setup`)
- [x] Live interview room with automatic TTS question playback, Web Audio visualizer, auto-recording, and fast auto-advance (`/interview/live/:sessionId`)
- [x] Async analysis pipeline (Face emotion analysis, Voice emotion analysis, NLP stub evaluation)
- [x] Report generation & Candidate Performance Report (`/report/:sessionId`)
- [x] Session History tracking & telemetry logs (`/history`)

## Active Requirements (Milestone 2)

### Phase 1 — Project Audit
- [ ] Comprehensive codebase audit across frontend, backend, database models, AI microservices, and media pipelines.
- [ ] System dependency map & feature matrix classification (Implemented, Partial, Missing, Broken, Needs Refactoring).

### Phase 2 — Cloudflare R2 Storage Abstraction
- [ ] S3-compatible Cloudflare R2 storage provider abstraction (`r2Service.js`).
- [ ] Presigned upload URL generation (Frontend → R2 direct upload, zero Node file buffering for large media).
- [ ] Security, file type/size validation, unique keying (`interviews/{interviewId}/...` and `resumes/{userId}/...`), and cleanup handlers.

### Phase 3 — Migrate Interview Media Pipeline to R2
- [ ] Migrate face & voice emotion models to ingest media directly from R2 object storage.
- [ ] Retryable BullMQ job processing states (`pending`, `processing`, `completed`, `failed`).
- [ ] Automatic cleanup of temporary media clips post-processing.

### Phase 4 — Speech-To-Text (Faster-Whisper)
- [ ] Full answer audio transcription using local `faster-whisper` model.
- [ ] Handle silence, long answers, background noise, and non-fatal audio glitches.
- [ ] Store transcripts linked to `interviewId` and `questionId`.

### Phase 5 — Intelligent Answer Evaluation
- [ ] LLM evaluation engine comparing Question + Expected Criteria + User STT Transcript.
- [ ] Structured evaluation metrics (`relevanceScore`, `correctnessScore`, `completenessScore`, `communicationScore`, `overallScore`, `strengths`, `improvements`).
- [ ] Deep technical correctness and behavioral structure analysis.

### Phase 6 — Database & Multimodal Result Aggregation
- [ ] Schema refinement linking User, Interview, Question, Answer, Media Keys, Emotion Data, Transcript, Evaluation, Writing Test, and Report.
- [ ] Idempotent partial success preservation (Face/Voice/STT partial results remain recoverable).

### Phase 7 — Writing Test Refinement & Flow Integration
- [ ] Seamless transition from interview completion to written evaluation test (`/interview/writing/:sessionId`).
- [ ] AI grammar, clarity, structure, vocabulary, and relevance scoring integrated into final report.

### Phase 8 — Resume-Grounded Interview Mode
- [ ] Resume PDF upload to R2 and text extraction.
- [ ] Structured resume data extraction (Skills, Education, Projects, Experience, Technologies) stored in MongoDB.
- [ ] Grounded question generator referencing actual resume experience without hallucinating candidates' backgrounds.

### Phase 9 — Font & Emoji Cleanup
- [ ] Typography standardization matching clean Figma Make design system.
- [ ] Removal of informal emojis across UI components in favor of professional design icons.

### Phase 10 — Full End-to-End Resilience & Load Audit
- [ ] End-to-end user flow verification from setup → R2 upload → AI processing → writing test → final report.
- [ ] Fault injection & failure mode testing (R2 timeout, STT failure, model error, network drop recovery).

## Out of Scope
- [ ] Live human interviewers (Platform is strictly 100% AI simulator)
