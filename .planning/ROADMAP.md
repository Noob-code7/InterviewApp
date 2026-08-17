# Project Roadmap — Milestone 2: Production Scale & AI Intelligence

## Phase 1: Project Audit & Dependency Mapping
**Goal:** Perform end-to-end repository inspection across frontend, backend, AI microservices, MongoDB models, and current local media flow. Produce comprehensive dependency map and classification matrix.

## Phase 2: Cloudflare R2 Storage Abstraction
**Goal:** Replace local filesystem storage with S3-compatible Cloudflare R2 object storage, presigned direct uploads, and secure credential isolation.

## Phase 3: Migrate Interview Media Pipeline to R2
**Goal:** Migrate face and voice emotion analysis pipelines to ingest media from R2 with retryable BullMQ jobs, state tracking (`pending`, `processing`, `completed`, `failed`), and post-processing clip cleanup.

## Phase 4: Speech-to-Text Engine (Faster-Whisper)
**Goal:** Integrate local `faster-whisper` microservice to transcribe full candidate answer audio with robust error handling for silence, background noise, and long answers.

## Phase 5: Intelligent Answer Evaluation
**Goal:** Build LLM answer evaluation engine comparing Question + Expected Criteria + User STT Transcript to produce structured multidimensional quality scores.

## Phase 6: Database Refinement & Result Aggregation
**Goal:** Standardize MongoDB data relationships across User, Session, Question, Answer, Media Keys, Transcripts, Evaluations, and Reports with partial-success preservation.

## Phase 7: Writing Test Audit & Report Integration
**Goal:** Refine the written assessment module (`/interview/writing/:sessionId`) and integrate grammar, clarity, structure, and vocabulary scores into the aggregated final report.

## Phase 8: Resume-Based Interview Mode
**Goal:** Implement resume PDF upload to R2, structured resume JSON extraction (skills, projects, experience), and grounded question generation without hallucinating experience.

## Phase 9: Font Standardization & Emoji Cleanup
**Goal:** Apply uniform typography and remove informal emojis across all pages while preserving the Figma Make visual identity.

## Phase 10: End-to-End Resilience Testing & Production Audit
**Goal:** Perform full end-to-end user flow verification, failure mode stress testing, load resilience auditing, and final production verification.
