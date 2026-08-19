# 🚀 InterviewAI — Hybrid AI Architecture & Phase Tracker

> **Core Design Philosophy:**  
> 100% Pure Local NLP/ML for standard and high-volume interviews ($0.00 API Cost).  
> Targeted LLM Router strictly for resume project comprehension, dynamic 2–3 follow-ups, and project answer grading.

---

## 📊 Interview Modes & Engine Allocation Matrix

| Interview Mode | Question Source | Dynamic Follow-Ups? | Evaluation Engine | LLM Token Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Technical Interview** | Predefined Question DB (OS, DBMS, OOP, DSA, CN, Web Dev) | ❌ None | **Local Concept & Cosine NLP** | **$0.00 (Zero LLM)** |
| **HR Interview** | Predefined Question DB (Behavioral, Situational, STAR) | ❌ None | **Local STAR / Concept NLP** | **$0.00 (Zero LLM)** |
| **Resume Interview** | **Multi-Track Composite:**<br>1. **HR Track:** Predefined Question DB<br>2. **Subject Track:** Question DB filtered by resume skills<br>3. **Project Track:** Generated from resume project text | ✅ **Yes (2–3 Project Follow-ups only)** | **Hybrid Architecture:**<br>• HR & Subjects: **Local NLP**<br>• Projects & Follow-ups: **LLM Router** | **Low / Targeted** (Only on projects) |

---

## 🗺️ Multi-Phase Implementation Roadmap

```
                                IMPLEMENTATION PHASES
                                          │
    ┌────────────────┬────────────────┬───┴────────────┬────────────────┬────────────────┐
    ▼                ▼                ▼                ▼                ▼                ▼
[ Phase 1 ]      [ Phase 2 ]      [ Phase 3 ]      [ Phase 4 ]      [ Phase 5 ]      [ Phase 6 ]
Question DB &    Resume Parser    Provider-        Live Dynamic     Evaluation       Unified
Local NLP        & Multi-Track    Agnostic LLM     Project Follow-  Dispatcher       Multimodal
Rubrics          Routing          Router           Up Loop          Routing          Report
```

---

### 📍 Phase 1: Question Bank Schema & Local NLP Rubric Hardening
- **Objective:** Upgrade MongoDB `Question` schema and local NLP engine beyond simple keyword checking to prevent fake high scores or stopword leaks.
- **Tasks & Checklist:**
  - [ ] **Schema Upgrade (`backend/models/Question.js`)**:
    - Add `expectedConcepts: [String]` (core conceptual points).
    - Add `acceptablePatterns: [String]` (valid explanation approaches).
    - Add `commonMisconceptions: [String]` (penalized false claims).
    - Add `difficulty: "easy" | "medium" | "hard"`.
    - Add `scoringRubric: { relevanceWeight, conceptWeight, structureWeight }`.
  - [ ] **Seed Script Enhancement (`backend/seed.js` / Question DB)**:
    - Seed questions across OS, DBMS, OOP, DSA, CN, Web Dev, and HR with full conceptual rubrics.
  - [ ] **Local Evaluator Upgrade (`ai-services/nlp-service/main.py`)**:
    - Evaluate transcript using: (1) Concept coverage, (2) Cosine semantic similarity, (3) STAR structure bonus, (4) Misconception deduction.
    - Zero artificial score floors (`0.0%` for silent or gibberish responses).
    - Strict stopword filtering on bigrams.
- **Status:** `[ ] Pending`

---

### 📍 Phase 2: Resume Parser & Multi-Track Question Routing
- **Objective:** Extract candidate technical skills and custom project descriptions from uploaded resumes (PDF/DOCX), assembling a structured multi-track question set.
- **Tasks & Checklist:**
  - [ ] **Resume Parser Upgrade (`ai-services/nlp-service/resume_parser.py`)**:
    - Extract `detectedSkills` (e.g. `["dbms", "react", "docker", "os"]`).
    - Extract `projects` array: `[{ title, techStack, description, role }]`.
  - [ ] **Resume Session Question Assembly (`backend/controllers/questionController.js`)**:
    - Track 1: Select 1–2 HR questions from Question DB.
    - Track 2: Select 2–3 Subject questions matching `detectedSkills` from Question DB.
    - Track 3: Pass extracted project text to LLM service to generate 1–2 grounded project questions.
    - Store questions with explicit `track: "hr" | "subject" | "project"` metadata in `Session.questions`.
- **Status:** `[ ] Pending`

---

### 📍 Phase 3: Provider-Agnostic LLM Service & Resilient Router
- **Objective:** Build a resilient, provider-agnostic LLM router capable of project question generation, follow-up inquiry, and answer evaluation with automatic fallback.
- **Tasks & Checklist:**
  - [ ] **LLM Router Implementation (`ai-services/nlp-service/llm_router.py` or `backend/services/llmService.js`)**:
    - Multi-provider support: OpenRouter (Primary) $\rightarrow$ Groq / Gemini API $\rightarrow$ OpenAI (Backup).
    - Automatic fallback on 429 rate limit, timeout, or 5xx server errors.
  - [ ] **Core Methods**:
    - `generateProjectQuestions(projectData)`: Grounded technical questions strictly based on the candidate's project stack and role.
    - `generateProjectFollowUp(project, question, answer, turnCount)`: Contextual deep-dive questions drilling into architecture, bottlenecks, or trade-offs.
    - `evaluateProjectAnswer(project, question, answer)`: Rubric-based technical scoring (Relevance, Technical Depth, Authenticity).
- **Status:** `[ ] Pending`

---

### 📍 Phase 4: Interactive Live Interview Project Follow-Up Loop
- **Objective:** Enable real-time dynamic follow-up questioning in the live interview room strictly for project questions (capped at 2–3 turns).
- **Tasks & Checklist:**
  - [ ] **Frontend Live Interview Logic (`frontend/src/pages/LiveInterviewPage.jsx`)**:
    - When an `hr` or `subject` question is answered $\rightarrow$ Advance directly to next question.
    - When a `project` question is answered $\rightarrow$ Show *"AI Interviewer is analyzing project response..."* $\rightarrow$ If follow-up generated, dynamically insert and ask follow-up question (Turn $1 \to 2 \to 3$).
    - Hard limit at maximum 3 follow-ups before smoothly proceeding to next question.
  - [ ] **Backend Follow-Up State Management (`backend/controllers/answerController.js`)**:
    - Track `followUpTurn` and link follow-up answers to parent project questions.
- **Status:** `[ ] Pending`

---

### 📍 Phase 5: Intelligent Evaluation Dispatcher & Media Safeguards
- **Objective:** Route each question's evaluation to the correct engine (Local NLP vs LLM Router) while safeguarding local audio and video telemetry pipelines.
- **Tasks & Checklist:**
  - [ ] **Evaluation Dispatcher (`backend/services/analysisService.js`)**:
    - `question.track === "hr" || "subject"` $\rightarrow$ Dispatch to **Local NLP** (`/analyze` on port 8003).
    - `question.track === "project"` $\rightarrow$ Dispatch to **LLM Router** with project context.
  - [ ] **Media Pipeline Health**:
    - Faster-Whisper local STT (Port 8002) with WebM & octet-stream compatibility.
    - PyTorch 8-Emotion SER model (Port 8002).
    - DeepFace visual & face substitution verification (Port 8001).
- **Status:** `[ ] Pending`

---

### 📍 Phase 6: Unified Multimodal Report Aggregation
- **Objective:** Combine all discrete evaluation streams into a comprehensive, transparent candidate report.
- **Tasks & Checklist:**
  - [ ] **Report Aggregation Formula (`backend/controllers/reportController.js`)**:
    $$\text{Overall Score} = 35\% \text{ Technical/Subject (Local NLP)} + 25\% \text{ Project (LLM)} + 15\% \text{ HR} + 15\% \text{ Voice SER} + 10\% \text{ Face Composure}$$
  - [ ] **Report UI Polish (`frontend/src/pages/ReportPage.jsx`)**:
    - Clear visual breakdown cards for:
      1. **Core Technicals & Subjects** (Local Concept Evaluation).
      2. **Project Deep-Dive & Follow-Ups** (LLM Contextual Evaluation).
      3. **HR & Behavioral Assessment** (STAR Methodology).
      4. **Voice SER 8-Emotion Spectrum** & **Visual Composure Index**.
      5. **Technical Writing Test Score**.
- **Status:** `[ ] Pending`

---

## 📌 Tracker Summary & Next Command

| Phase # | Phase Title | Status |
| :--- | :--- | :--- |
| **Phase 1** | Question Bank Schema & Local NLP Rubric Hardening | `[✅ Completed]` |
| **Phase 2** | Resume Parser & Multi-Track Question Routing | `[✅ Completed]` |
| **Phase 3** | Provider-Agnostic LLM Service & Resilient Router | `[✅ Completed]` |
| **Phase 4** | Interactive Live Interview Project Follow-Up Loop | `[✅ Completed]` |
| **Phase 5** | Intelligent Evaluation Dispatcher & Media Safeguards | `[✅ Completed]` |
| **Phase 6** | Unified Multimodal Report Aggregation | `[✅ Completed]` |

