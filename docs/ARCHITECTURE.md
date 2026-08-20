# Deep System Architecture & Engineering Blueprint — InterviewAI

## 1. Architectural Philosophy & Design Principles

InterviewAI is architected from the ground up as a **distributed, multi-modal, event-driven platform** that bridges real-time browser-based conversational interaction with asynchronous high-throughput machine learning inference. 

### Core Architectural Invariants:
1. **Decoupled Gateway & Specialized Microservices**: The Node.js/Express gateway manages state, authentication, session lifecycle, and media orchestration. It delegates computationally intensive deep learning tasks to dedicated Python FastAPI microservices running in isolated runtime environments.
2. **Deterministic Evaluation with Optional Semantic Extension**: Core scoring is handled by an ultra-fast, local, deterministic NLP engine with strict correctness bounds, supplemented by external LLMs only for open-ended project deep-dives.
3. **Single-Origin Deployment Parity**: The exact same application code runs in both multi-container cloud environments (via Docker Compose and Cloudflare R2) and air-gapped campus laboratories (via PM2 and local disk storage).
4. **Client-Side Latency Minimization**: Voice Activity Detection (VAD), interim speech transcription, and barge-in cutoffs are executed on the client's Web Audio / Web Speech thread, ensuring sub-150ms conversational response times.

---

## 2. End-to-End System Topology

```mermaid
flowchart TD
    subgraph ClientLayer["1. Client Layer (Browser Frontend)"]
        ReactSPA["React 18 SPA (Vite + TailwindCSS)"]
        WebAudio["Web Audio AnalyserNode (RMS & FFT Energy)"]
        SpeechAPI["Web Speech Recognition API (Interim Tokens)"]
        MediaRecorderAPI["MediaRecorder (Adaptive Chunking WebM/WAV)"]
        StateFSM["Single-Owner Interview FSM"]
    end

    subgraph GatewayLayer["2. Application Gateway Layer (Node.js :5000)"]
        Express["Express.js API Router"]
        AuthGuard["JWT Cookie Authentication & RBAC"]
        SessionCtrl["Session Lifecycle & Question Controller"]
        StorageService["Storage Abstraction Layer (S3 / R2 / Local FS)"]
        AnalysisOrchestrator["Analysis Concurrency Orchestrator (K=2 Worker)"]
        ReportAggregator["Composite Multi-Modal Aggregator"]
    end

    subgraph AILayer["3. Python AI Microservices Cluster"]
        FaceService["Face Service (:8001)\n- OpenCV Video Frame Extractor\n- DeepFace Emotion Model\n- VGG-Face Identity Verifier\n- Eye Contact / Attention Geometry"]
        VoiceService["Voice Service (:8002)\n- Wav2Vec 2.0 PyTorch SER Model\n- Kokoro-82M ONNX Neural TTS Engine\n- Pitch / Energy / Jitter Extractor"]
        NLPService["NLP Service (:8003)\n- Calibrated Dual-Pillar Concept Matcher\n- Correctness Floor & Gating Engine\n- Resume Document Parser (pypdf/docx2txt)\n- OpenRouter LLM Router (Async Cascade)"]
    end

    subgraph DataLayer["4. Persistence & Queue Infrastructure"]
        MongoDB[("MongoDB Database\n- Users\n- Sessions\n- QuestionBank (285 Qs)\n- QuestionHistory (Anti-Repetition)")]
        RedisQueue[("Redis 7 + BullMQ\n- Asynchronous Job Queues\n- Worker Recovery State")]
        ObjectStorage[("Cloudflare R2 / AWS S3\n- Pre-signed Direct PUTs\n- Ephemeral Media Lifecycle")]
    end

    subgraph CloudLLM["5. External Cloud LLM Fallback (Optional)"]
        OpenRouter["OpenRouter Cloud Gateway\n(nvidia/nemotron-3-super-120b / DeepSeek)"]
    end

    %% Client Interactions
    ReactSPA <-->|"REST API (JSON over HTTPS)"| Express
    WebAudio -->|"RMS Energy Stream (every 50ms)"| StateFSM
    SpeechAPI -->|"Real-Time Transcript Tokens"| StateFSM
    MediaRecorderAPI -->|"Direct Presigned PUT / Local Upload"| StorageService

    %% Gateway to Data
    Express <-->|"Mongoose ODM"| MongoDB
    Express <-->|"Queue / Lock Management"| RedisQueue
    StorageService <-->|"S3 SDK / Local File Stream"| ObjectStorage

    %% Gateway to AI Microservices
    AnalysisOrchestrator -->|"POST /analyze (Video Payload)"| FaceService
    AnalysisOrchestrator -->|"POST /analyze + /synthesize (Audio Payload)"| VoiceService
    AnalysisOrchestrator -->|"POST /analyze (Transcript + Rubric)"| NLPService

    %% AI Microservices Internals
    NLPService -.->|"Async LLM Routing (Project Qs)"| OpenRouter

    %% Output Pipeline
    FaceService & VoiceService & NLPService -->|"Standardized Metric JSON"| ReportAggregator
    ReportAggregator -->|"Persist Final Report"| MongoDB
    ReportAggregator -->|"Return Comprehensive Report"| ReactSPA
```

---

## 3. Detailed Component Deep-Dive

### 3.1 Frontend Single-Owner Architecture (`frontend/src/`)
The frontend is engineered to handle intensive multi-threaded browser operations without frame drops:
- **Audio Processing Thread**: The `useVoiceActivityDetector` hook instantiates an `AudioContext` running an `AnalyserNode` with `fftSize = 512`. It samples audio RMS every 50ms to detect energy surges.
- **Speech Ingestion Thread**: Utilizes continuous `webkitSpeechRecognition` to produce real-time interim tokens for transcript confirmation, debouncing non-speech acoustic spikes.
- **Media Streaming**: `MediaRecorder` captures dual video/audio streams encoded in `video/webm;codecs=vp8,opus` or `video/webm;codecs=vp9,opus` at 30 FPS.
- **State Synchronization**: All component actions report to a central Finite State Machine in [`frontend/src/pages/LiveInterviewPage.jsx`](file:///C:/Workspace/Workspace/InterviewApp/frontend/src/pages/LiveInterviewPage.jsx) with atomic generation locks (`generationIdRef`) to eliminate race conditions.

### 3.2 Backend Gateway & Queue Management (`backend/`)
- **Express.js API Gateway**: Manages session creation, question filtering, answer metadata ingestion, and report delivery.
- **Controlled Concurrency Orchestrator**: In [`backend/services/analysisService.js`](file:///C:/Workspace/Workspace/InterviewApp/backend/services/analysisService.js), multi-modal analysis jobs are processed with worker concurrency caps ($K = 2$) to ensure machine resources are never overwhelmed during batch evaluation.
- **Ephemeral Media Lifecycle**: Once media buffers are consumed and evaluated by the AI microservices, the storage layer triggers an automated unlinking sweep to prevent disk accumulation.

### 3.3 The AI Microservices Cluster (`ai-services/`)
Each AI service is an independent FastAPI application running Uvicorn:
- **Face Analysis Microservice (Port `8001`)**:
  - Extracts frames at 1-second intervals using OpenCV.
  - Passes cropped face tensors through DeepFace to evaluate 7 discrete emotions.
  - Verifies facial landmarks and face pose to score gaze attention.
  - Compares candidate identity against the initial baseline snapshot using VGG-Face cosine distance to detect candidate substitution.
- **Voice Analysis Microservice (Port `8002`)**:
  - Ingests 16kHz mono WAV audio buffers.
  - Runs inference through a PyTorch Wav2Vec 2.0 Speech Emotion Recognition model (`best_model_path.pth`) to extract vocal confidence, jitter, and pitch stability.
  - Houses the Kokoro-82M ONNX Neural TTS engine (`kokoro_tts.py`) to synthesize 24kHz natural speech in $<150	ext{ms}$.
- **NLP Analysis Microservice (Port `8003`)**:
  - Implements a calibrated, dual-pillar keyword and concept matching algorithm with mathematical correctness floor gating.
  - Contains document parsers (`pypdf`, `docx2txt`) for extracting skills, architectures, and experiences from candidate resumes.
  - Integrates an OpenRouter LLM router with automated fallback cascade across free and commercial model tiers.

---

## 4. End-to-End Execution Sequence Diagrams

### 4.1 Live Conversational Interview Flow (Synchronous Client Execution)

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate Browser
    participant Gateway as Express Gateway (:5000)
    participant Storage as Cloudflare R2 / Local Disk
    participant VoiceAI as Voice Service (:8002)

    Note over Candidate, Gateway: Session Creation & Question Dispatch
    Candidate->>Gateway: POST /api/sessions (track, subject, count)
    Gateway-->>Candidate: 201 Created (Session ID, 5 Questions)

    Note over Candidate, VoiceAI: Question Delivery & Audio Streaming
    Candidate->>VoiceAI: POST /api/tts/synthesize (question text)
    VoiceAI-->>Candidate: Stream 24kHz WAV Audio (<150ms)
    Candidate->>Candidate: Audio Plays | State: QUESTION_SPEAKING

    alt Candidate Speaks Mid-Question (Barge-In)
        Candidate->>Candidate: VAD Detects RMS > 0.025 + Speech Token
        Candidate->>Candidate: Cancel Audio Playback | Invalidate Generation ID
        Candidate->>Candidate: State -> INTERRUPTED_CONTINUING | Start MediaRecorder
    else AI Finishes Question Naturally
        Candidate->>Candidate: Audio Ends | State -> QUESTION_LISTENING | Start MediaRecorder
    end

    Note over Candidate, Storage: Candidate Answers & Auto-Progression
    Candidate->>Candidate: Candidate Speaks Answer (Live Transcription)
    Candidate->>Candidate: Silence > 2.2s Detected | State -> ANSWER_FINALIZING
    Candidate->>Candidate: Stop MediaRecorder -> Package WebM Blob

    Candidate->>Gateway: GET /api/storage/presigned-upload-url (key: answer-q1.webm)
    Gateway-->>Candidate: Return Pre-signed Upload URL
    Candidate->>Storage: Direct PUT WebM Binary Stream
    Storage-->>Candidate: 200 OK
    Candidate->>Gateway: POST /api/sessions/:id/answers (questionId, transcript, videoUrl)
    Gateway-->>Candidate: 200 OK (Answer Stored)

    Candidate->>Candidate: State -> PROCESSING_TRANSITION | Advance to Next Question
```

### 4.2 Multi-Modal AI Evaluation Flow (Asynchronous Orchestration)

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate Browser
    participant Gateway as Express Gateway (:5000)
    participant Storage as Storage Layer (R2 / Disk)
    participant FaceAI as Face Service (:8001)
    participant VoiceAI as Voice Service (:8002)
    participant NLPAI as NLP Service (:8003)
    participant DB as MongoDB

    Candidate->>Gateway: POST /api/analysis/:sessionId/process
    Gateway->>DB: Fetch Session Answers & Question Metadata
    Gateway->>Storage: Retrieve Media Buffers (Video/Audio)

    par Parallel Face Analysis
        Gateway->>FaceAI: POST /analyze (videoBuffer, referenceImage)
        FaceAI->>FaceAI: OpenCV Frame Extraction (1 fps)
        FaceAI->>FaceAI: DeepFace Emotion + VGG-Face Identity Check
        FaceAI-->>Gateway: { confidenceScore, attentionScore, eyeContactScore, substitutionAlert }
    and Parallel Voice Analysis
        Gateway->>VoiceAI: POST /analyze (audioBuffer)
        VoiceAI->>VoiceAI: Wav2Vec 2.0 PyTorch Inference
        VoiceAI-->>Gateway: { confidenceScore, nervousnessScore, toneDistribution }
    and Parallel NLP Analysis
        Gateway->>NLPAI: POST /analyze (transcript, question, expectedConcepts, rubrics)
        NLPAI->>NLPAI: Dual-Pillar Concept Matcher + Floor Gating
        NLPAI-->>Gateway: { correctnessScore, relevanceScore, completenessScore, feedback }
    end

    Gateway->>Gateway: Compute Composite Score & Readiness Tier (High/Medium/Low)
    Gateway->>Storage: Trigger Automated Media Cleanup (Unlink Video/Audio)
    Gateway->>DB: Save Detailed Performance Report & Update Status to 'completed'
    Gateway-->>Candidate: 200 OK (Full Multi-Modal Report)
```
