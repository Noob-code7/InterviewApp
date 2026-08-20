# System Architecture — InterviewAI

## 1. High-Level Architecture Overview

InterviewAI is a multi-service, multi-modal artificial intelligence platform designed to conduct natural, real-time technical and behavioral interviews. The platform evaluates candidates across three distinct modalities simultaneously: **facial dynamics (vision)**, **vocal prosody (speech emotion)**, and **conceptual correctness (natural language processing)**.

The system is built as an event-driven, decoupled microservices architecture with a centralized API gateway that orchestrates client state, persistence, media routing, and AI analysis.

```mermaid
flowchart TD
    subgraph ClientLayer["1. Client Layer (Browser)"]
        UI["React 18 Single Page Application"]
        WebAudio["Web Audio API (AnalyserNode + RMS)"]
        SpeechRec["Web Speech Recognition API"]
        MediaRecorder["MediaRecorder (Video/Audio Stream)"]
    end

    subgraph GatewayLayer["2. Gateway & Application Backend (:5000)"]
        Express["Express.js HTTP & REST API Gateway"]
        AuthMiddleware["JWT Authentication & RBAC Middleware"]
        SessionFSM["Session Lifecycle & State Machine Controller"]
        StorageService["Storage Abstraction Layer (S3 / R2 / Local Disk)"]
        Aggregator["Score Aggregator & Report Generator"]
        BullMQQueue["BullMQ Job Dispatcher"]
    end

    subgraph AILayer["3. Python AI Microservices Cluster"]
        FaceService["Face Service (:8001)\nOpenCV + DeepFace (VGG-Face)"]
        VoiceService["Voice Service (:8002)\nWav2Vec 2.0 PyTorch + Kokoro-82M ONNX TTS"]
        NLPService["NLP Service (:8003)\nCalibrated Local Evaluator + Resume Parser + LLM Router"]
    end

    subgraph PersistenceLayer["4. Persistence & Queue Infrastructure"]
        MongoDB[("MongoDB Database\n(Users, Sessions, Questions, QuestionHistory)")]
        RedisDB[("Redis 7 In-Memory Cache & Queue Broker")]
        MediaStorage[("Cloudflare R2 / AWS S3\n(Local Disk Fallback: backend/uploads)")]
    end

    subgraph ExternalLayer["5. External Cloud Providers (Optional)"]
        OpenRouter["OpenRouter Cloud LLMs\n(Nemotron-3-Super / Free Tier Models)"]
    end

    %% Client to Gateway
    UI <-->|"REST API (JSON over HTTPS)"| Express
    WebAudio -->|"Real-time RMS & Energy Events"| UI
    SpeechRec -->|"Interim & Final Speech Transcripts"| UI
    MediaRecorder -->|"Pre-signed PUT / Local Multipart Stream"| StorageService

    %% Gateway to Persistence
    Express <-->|"Mongoose ODM"| MongoDB
    Express <-->|"Job Enqueue / Worker Events"| BullMQQueue
    BullMQQueue <-->|"Persistence & State"| RedisDB
    StorageService <-->|"Object Put / Get / Delete"| MediaStorage

    %% Gateway to AI Services
    Express -->|"POST /analyze (Video Payload)"| FaceService
    Express -->|"POST /analyze + /synthesize (Audio Payload)"| VoiceService
    Express -->|"POST /analyze + /extract-resume-text"| NLPService

    %% AI to External
    NLPService -.->|"Optional Deep-Dive Queries"| OpenRouter

    %% Result Flow
    FaceService & VoiceService & NLPService -->|"Structured Metric JSON"| Aggregator
    Aggregator -->|"Persist Final Report"| MongoDB
    Aggregator -->|"Return Comprehensive Report"| UI
```

---

## 2. Component Responsibilities

### 2.1 Client Layer (Frontend SPA)
- **Framework**: React 18, Vite, TailwindCSS, Zustand (Global State), React Router v6.
- **Role**:
  - Renders dynamic candidate/faculty views, camera preview, and live audio visualizers.
  - Manages real-time interview state transitions using a single-owner state machine.
  - Executes client-side Voice Activity Detection (VAD) via `useVoiceActivityDetector` hook to detect candidate speech onsets and barge-ins.
  - Captures video/audio chunks using `MediaRecorder` API and streams answers to storage endpoints.
  - Synthesizes spoken AI voice output via the backend Kokoro TTS proxy with seamless Web Speech API fallbacks.

### 2.2 API Gateway & Application Backend (`backend/`)
- **Runtime**: Node.js (ES Modules), Express.js.
- **Port**: `5000`.
- **Role**:
  - Exposes RESTful endpoints for authentication, session orchestration, question delivery, answer ingestion, and report generation.
  - Enforces JWT authentication stored in HTTP-only secure cookies with role-based access control (Student vs Faculty).
  - Handles question selection logic with per-user repetition tracking (`QuestionHistory`).
  - Abstracts media storage across Cloudflare R2, AWS S3, and local filesystem fallbacks.
  - Dispatches parallel analysis requests to the AI microservices cluster and aggregates multi-modal metrics.
  - Optionally hosts the compiled frontend SPA in single-origin mode (`SERVE_FRONTEND=true`) for campus LAN deployments.

### 2.3 AI Microservices Cluster (`ai-services/`)
- **Runtime**: Python 3.11+, FastAPI, Uvicorn.
- **Face Service (`:8001`)**:
  - Samples video frames at regular intervals using OpenCV.
  - Performs emotion classification (`happy`, `neutral`, `surprise`, `fear`, `sad`, `angry`, `disgust`) and eye-contact/attention geometry.
  - Verifies candidate identity against an optional baseline reference photo using DeepFace (VGG-Face) to detect face substitution.
- **Voice Service (`:8002`)**:
  - Analyzes audio waveforms using a fine-tuned Wav2Vec 2.0 Speech Emotion Recognition (SER) PyTorch model.
  - Synthesizes ultra-fast (<150ms) natural speech audio using an ONNX-accelerated Kokoro-82M neural engine.
- **NLP Service (`:8003`)**:
  - Evaluates candidate answers using a local, deterministic, calibrated evaluation engine (dual-pillar keyword + concept matching).
  - Enforces strict correctness gating to ensure factual errors, prompt echoes, and buzzword dumps receive genuine failing scores.
  - Parses PDF and DOCX resumes to extract skills and project descriptions.
  - Routes complex project questions to external LLMs (via OpenRouter) with automatic fallback to offline templates.

---

## 3. Communication & Data Flow

### 3.1 Synchronous vs Asynchronous Workflows

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate Browser
    participant Gateway as Express Gateway (:5000)
    participant Storage as Cloud Storage / Local Disk
    participant AI as AI Microservices (:8001, :8002, :8003)
    participant DB as MongoDB

    Note over Candidate, Gateway: 1. Setup & Question Retrieval (Synchronous)
    Candidate->>Gateway: POST /api/sessions (Track, Subject, Count)
    Gateway->>DB: Query Questions (Exclude User History)
    DB-->>Gateway: Return Selected Questions
    Gateway-->>Candidate: 201 Created (Session ID & Questions)

    Note over Candidate, Storage: 2. Live Spoken Answer & Streaming (Synchronous Client-Side)
    Candidate->>Candidate: VAD Detects Speech -> Records Video/Audio
    Candidate->>Gateway: POST /api/storage/presigned-url (or local upload)
    Gateway-->>Candidate: Upload URL
    Candidate->>Storage: Direct PUT Video/Audio Payload
    Candidate->>Gateway: POST /api/sessions/:id/answers (questionId, transcript, videoUrl)
    Gateway->>DB: Save Answer Metadata

    Note over Gateway, AI: 3. Multi-Modal Analysis (Parallelized Gateway Dispatch)
    Candidate->>Gateway: POST /api/analysis/:sessionId/process
    par Face Analysis
        Gateway->>AI: POST :8001/analyze (videoUrl)
        AI-->>Gateway: Emotion, Eye Contact, Attention Scores
    and Voice Analysis
        Gateway->>AI: POST :8002/analyze (audioUrl)
        AI-->>Gateway: Vocal Confidence, Energy, Pitch Scores
    and Local NLP Analysis
        Gateway->>AI: POST :8003/analyze (transcript, question, expectedConcepts)
        AI-->>Gateway: Correctness, Relevance, Completeness Scores
    end

    Note over Gateway, DB: 4. Aggregation & Report Generation
    Gateway->>Gateway: Compute Composite Score & Readiness Tier
    Gateway->>DB: Update Session (status: "completed", detailedReport)
    Gateway-->>Candidate: 200 OK (Full Multi-Modal Report)
```

---

## 4. Security & Isolation Architecture

1. **Token Security**: Authentication uses stateless JWT tokens transmitted via `HttpOnly`, `SameSite=Lax` cookies, shielding against Cross-Site Scripting (XSS) attacks.
2. **API Rate Limiting**: Employs `express-rate-limit` with differentiated budgets:
   - Development mode: 50,000 requests / 15 min.
   - Cloud production: 300 requests / 15 min per IP.
   - Campus LAN deployment: Configurable via `RATE_LIMIT_MAX` to support hundreds of student clients sharing a single campus gateway IP.
3. **Data Isolation**: Each session is permanently bound to the owning user's `userId`. Session queries and analysis reports strictly enforce ownership verification.
4. **Media Ephemerality**: Temporary video/audio media stored during the interview is analyzed and automatically unlinked upon report generation to prevent disk exhaustion and respect candidate privacy.
