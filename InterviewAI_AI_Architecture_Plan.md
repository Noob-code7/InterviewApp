# InterviewAI — Architecture & AI Strategy
## Decisions and Plan Discussed

> This document consolidates the architecture, model strategy, and interview flow decisions discussed today.

---

## 1. Core Objective

InterviewAI is a real-time AI interview simulator designed to:

- Conduct technical and HR interviews.
- Ask questions from a predefined question database.
- Analyze candidate answers.
- Generate contextual follow-up questions when appropriate.
- Conduct resume-based interviews.
- Ask project-specific questions based on the candidate's own projects.
- Analyze voice/facial signals using the existing ML pipeline.
- Produce a final interview performance report.

The system should remain **cost-efficient and scalable**, because potentially all 4th-year students may use it.

---

## 2. Main AI Strategy

We decided **not to send every candidate answer to an LLM**.

Instead, use a **hybrid architecture**:

```text
                    Interview
                       |
          +------------+-------------+
          |                          |
    Local NLP / ML                  LLM
          |                          |
  Routine evaluation        Contextual reasoning
  Fixed questions           Project-specific questions
  Subject questions         Project follow-ups
  HR questions              Project-answer evaluation
                             Resume/project reasoning
```

### Principle

Use local processing wherever the task can be handled reliably and deterministically.

Use an LLM only where deeper reasoning and contextual understanding provide significant value.

This reduces:

- API costs
- API rate-limit pressure
- latency
- dependency on a single provider

---

# 3. Default Question Bank

The existing database contains predefined interview questions.

These questions will continue to be used for standard interviews.

### Example topics

- Operating Systems
- DBMS
- SQL
- OOP
- DSA
- Computer Networks
- Web Development
- Other technical subjects

The system should not unnecessarily call an LLM for these fixed questions.

---

# 4. Local NLP / ML for Default Questions

For questions already present in the database, use the existing local NLP/ML pipeline for answer evaluation.

The question database should contain more than just a question and keywords.

Recommended structure:

```text
Question
├── Topic
├── Difficulty
├── Expected concepts
├── Keywords / phrases
├── Acceptable answer patterns
├── Common misconceptions
└── Scoring rubric
```

### Example

```json
{
  "question": "What is a process in an operating system?",
  "topic": "OS",
  "difficulty": "easy",
  "expected_concepts": [
    "program in execution",
    "process state",
    "process control block"
  ],
  "keywords": [
    "PCB",
    "process state",
    "program counter"
  ],
  "common_mistakes": [
    "confusing process with program"
  ]
}
```

### Important

Do **not** rely solely on keyword matching.

The evaluation should ideally combine:

- semantic similarity
- concept coverage
- keyword signals
- answer relevance
- completeness
- existing ML/NLP signals

This prevents a candidate from receiving a high score simply by mentioning technical keywords without understanding the concept.

---

# 5. Local NLP — What It Is Used For

Local NLP means processing the candidate's transcript locally instead of sending every answer to an external LLM.

It can provide measurable signals such as:

- keyword/concept coverage
- semantic similarity
- relevance
- answer length
- vocabulary
- technical terminology
- readability
- similarity against expected answers

The existing project also has other local ML components for voice and facial analysis.

Local NLP is suitable for **routine fixed-question evaluation**, but it is not expected to match an LLM's ability to reason deeply about whether a technically complex explanation is actually correct.

---

# 6. Adaptive Follow-Up Questions

The project should support **contextual follow-up questions**, rather than only asking a fixed sequence of questions.

However, we decided not to use an LLM for every standard question.

The LLM will primarily be used when a contextual follow-up is needed.

Example:

```text
Question:
What is a database index?

Candidate:
An index makes database queries faster by storing data separately.

LLM follow-up:
You mentioned that indexing improves query performance.
What trade-off does maintaining an index introduce during
INSERT and UPDATE operations?
```

The important behavior is:

> The follow-up should be based on what the candidate actually said.

It should not simply select another random question from the database.

---

# 7. Resume-Based Interview Architecture

The project already uses a **resume parser** to extract information from uploaded resumes.

The resume should be treated as structured input rather than sending the entire resume blindly to an LLM.

The parser extracts information such as:

```text
Resume
├── Subjects / Areas of Interest
├── Skills
├── Projects
├── Experience
├── Education
└── Other relevant information
```

---

# 8. Subject-Based Resume Questions

If the resume contains subjects/areas of interest such as:

```text
OS
DBMS
SQL
```

the system should select questions from the **existing question database**.

Example:

```text
Resume says:
Areas of Interest → OS, DBMS, SQL

↓

OS → select existing OS questions
DBMS → select existing DBMS questions
SQL → select existing SQL questions
```

These questions are evaluated using the existing **local NLP/ML system**.

### No LLM required

The flow is:

```text
Resume
  ↓
Resume Parser
  ↓
Extract subjects
  ↓
Select questions from DB
  ↓
Candidate answer
  ↓
Local NLP/ML
  ↓
Evaluation
```

This keeps subject-based resume interviews cheap and scalable.

---

# 9. HR-Based Questions

HR questions should also remain primarily local.

Examples:

- Tell me about yourself.
- What are your strengths?
- Why should we hire you?
- What are your career goals?

These can use predefined questions and the existing local NLP evaluation system.

### No LLM required by default.

---

# 10. Project-Specific Resume Questions

This is the primary area where the LLM will be used.

If the resume contains:

```text
Project:
InterviewAI

Technologies:
React
Node.js
MongoDB
FastAPI
Redis
BullMQ
...
```

the project details are passed to the LLM.

The LLM generates **project-specific technical questions** based on what the candidate actually claims to have built.

Example:

> You mentioned using BullMQ and Redis for asynchronous processing. Why did you choose a queue-based architecture instead of processing these tasks synchronously?

This is preferable to a generic question because it tests whether the candidate actually understands their own project.

---

# 11. Project Follow-Up Limit

To control API usage and prevent endless conversations:

### Maximum: 2–3 LLM follow-up questions per project.

Example:

```text
Project Question
      ↓
Candidate Answer
      ↓
LLM Evaluation
      ↓
Follow-up #1
      ↓
Candidate Answer
      ↓
LLM Evaluation
      ↓
Follow-up #2
      ↓
Candidate Answer
      ↓
LLM Evaluation
      ↓
STOP
```

The LLM can also stop earlier if the candidate has already demonstrated sufficient technical depth.

---

# 12. Project Question + Evaluation Flow

For project-related interviews:

```text
Resume Parser
      ↓
Extract Project Details
      ↓
Send Project Context to LLM
      ↓
Generate Project Question
      ↓
Candidate Answers
      ↓
LLM Evaluates Answer
      ↓
Generate Contextual Follow-Up
      ↓
Candidate Answers
      ↓
LLM Evaluates Follow-Up
      ↓
Maximum 2–3 Follow-Ups
      ↓
Project Evaluation
```

The LLM should evaluate:

- technical correctness
- technical depth
- reasoning
- understanding of implementation
- consistency with the resume
- missing concepts
- weaknesses
- quality of explanation

---

# 13. Final Interview Architecture

The planned system is:

```text
                         RESUME
                            |
                     Resume Parser
                            |
             +--------------+--------------+
             |              |              |
          Subjects       Projects          HR
             |              |              |
             ↓              ↓              ↓
      Question DB         LLM          Question DB
             |              |              |
             ↓              ↓              ↓
       Local NLP/ML       LLM         Local NLP/ML
             |              |              |
             +--------------+--------------+
                            |
                   Final Interview Report
                            |
             +--------------+--------------+
             |              |              |
        Technical       Project        HR/General
          Score          Score            Score
             |              |              |
             +--------------+--------------+
                            |
                    Overall Performance
```

---

# 14. Existing ML Components

The LLM will not replace the project's existing ML pipeline.

The existing project already includes components for:

### Speech / Audio

- Whisper for speech-to-text
- Librosa for audio analysis
- Web Audio API / audio processing

### Facial Analysis

- DeepFace
- OpenCV
- frame sampling
- emotion analysis
- confidence/nervousness-related metrics

### Backend / Async Processing

- Node.js + Express
- Python FastAPI microservices
- BullMQ
- Redis

These components remain part of the system.

---

# 15. LLM Provider Strategy

We discussed several approaches.

### Option A — Single API provider

Simple, but creates a single point of failure.

### Option B — Multiple providers

Recommended for production reliability.

Example:

```text
                 LLM Router
                     |
          +----------+----------+
          |                     |
      Provider A            Provider B
       Primary               Backup
```

Normal traffic can go to the primary provider.

If the primary returns:

- 429 / rate limit
- timeout
- provider failure
- temporary outage

the backend can route the request to the backup provider.

### Important

Use **different providers** for redundancy rather than creating multiple keys from the same provider merely to multiply quotas.

---

# 16. Free API Strategy

We investigated whether a completely free and unlimited API could support the entire college.

Conclusion:

> Do not assume that any free API provides unlimited tokens, unlimited requests, and guaranteed capacity for hundreds of simultaneous students.

Free tiers have request/token/rate/concurrency limits and can become congested.

Therefore:

- Free APIs are useful for development/testing.
- A production college-wide deployment should have a paid/fallback strategy.
- Multiple legitimate providers can improve reliability.
- Self-hosting is possible but requires appropriate GPU infrastructure.

---

# 17. OpenRouter

OpenRouter was considered because it provides access to multiple models through one API.

Advantages:

- model flexibility
- easy model switching
- provider abstraction
- useful for testing different models

However:

> OpenRouter's free models should not be treated as unlimited infrastructure for hundreds of simultaneous students.

The application should therefore not depend exclusively on OpenRouter's free tier.

---

# 18. Local LLM / Self-Hosting

We also considered running an open-weight LLM locally.

The architecture would be:

```text
Students
   ↓
InterviewAI Backend
   ↓
College GPU Server
   ↓
Ollama / vLLM
   ↓
Open-weight LLM
```

The LLM would run on a dedicated machine rather than the developer's personal computer.

A deployed application cannot directly access an LLM running on the developer's PC unless the PC is exposed as a server, which is not recommended for production.

### College deployment

If the college provided a suitable GPU server, the model could be installed there.

However, this was considered impractical because the college is unlikely to provide or allow such infrastructure.

Therefore, **API-based inference is currently the preferred deployment approach.**

---

# 19. OpenAI Open-Weight Models

OpenAI's open-weight `gpt-oss` models were also discussed.

They can be self-hosted, but they still require suitable GPU infrastructure.

For this project, self-hosting a model such as `gpt-oss-20b` is technically possible but probably unnecessary given the college infrastructure constraints.

---

# 20. Recommended Final AI Split

This is the final agreed architecture:

| Interview Component | Technology |
|---|---|
| Default technical questions | Local NLP/ML |
| Default technical answer evaluation | Local NLP/ML |
| Subject-based resume questions | Existing Question DB + Local NLP/ML |
| Subject-based answer evaluation | Local NLP/ML |
| HR questions | Existing Question DB + Local NLP/ML |
| HR answer evaluation | Local NLP/ML |
| Project-specific questions | LLM |
| Project follow-up questions | LLM |
| Project answer evaluation | LLM |
| Project follow-up evaluation | LLM |
| Resume extraction | Existing Resume Parser |
| Speech-to-text | Whisper |
| Voice analysis | Existing local ML |
| Facial analysis | DeepFace/OpenCV |
| Final report | Combine all evaluation signals |

---

# 21. Key Design Principle

The most important architectural decision is:

> **Do not use an LLM simply because an LLM can do something. Use it only where its reasoning ability provides a meaningful advantage.**

### Local NLP/ML handles:

- predictable
- predefined
- repetitive
- high-volume tasks

### LLM handles:

- contextual reasoning
- project understanding
- dynamic question generation
- follow-up questions
- nuanced project-answer evaluation

This provides a better balance between:

**Cost + scalability + latency + intelligence + reliability.**

---

# 22. Future Improvement

Once the system is working, collect structured interview examples:

```text
Question
Candidate Answer
Local Evaluation
LLM Evaluation
Follow-Up
Reason for Follow-Up
Final Score
```

This dataset can later be used to improve the evaluation system or potentially fine-tune an open-weight model.

However:

> **Do not train an LLM from scratch.**

If model customization is eventually required, fine-tuning an existing open-weight model is the realistic direction.

---

# 23. Immediate Implementation Plan

### Phase 1 — Preserve Existing System

Do not break:

- existing question database
- resume parser
- local NLP/ML
- voice analysis
- facial analysis
- final report generation

### Phase 2 — Improve Question Database

Add:

- expected concepts
- keywords
- acceptable answers
- common misconceptions
- difficulty
- scoring weights

### Phase 3 — Resume Routing

After resume parsing:

```text
Subjects → existing question DB
Projects → LLM pipeline
HR → existing HR questions
```

### Phase 4 — Implement Project LLM

Build a provider-agnostic LLM service capable of:

1. Receiving project details.
2. Generating an appropriate technical question.
3. Evaluating the candidate's answer.
4. Generating a contextual follow-up.
5. Evaluating the follow-up.
6. Stopping after 2–3 follow-ups.

### Phase 5 — Add LLM Router

Keep the LLM provider replaceable:

```text
LLMService
   |
   +-- Provider A
   |
   +-- Provider B
   |
   +-- Optional Provider C
```

This prevents the application from becoming locked to one provider.

### Phase 6 — Final Report

Combine:

```text
Local Technical Evaluation
+
Project LLM Evaluation
+
HR Evaluation
+
Voice Analysis
+
Facial Analysis
+
Other Existing ML Signals
```

into the final candidate report.

---

## Final Decision

**InterviewAI will use a hybrid AI architecture.**

> **Local NLP/ML for default, subject-based, and HR interviews.  
> LLM for project-specific questions, 2–3 contextual project follow-ups, and their evaluation.**

This is the current planned architecture and should be treated as the baseline for future implementation decisions.


🎯 Clear Architectural Mapping: Interview Types & Engine Dispatch
This distinction ensures $0 API cost for standard interviews while providing deep contextual reasoning for custom project evaluations.

                                  INTERVIEW TYPES
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  [ HR Interview ]             [ Technical Interview ]          [ Resume Interview ]
  (100% Pure Local NLP)        (100% Pure Local NLP)            (Hybrid Multi-Track)
  ├── Fixed HR Questions       ├── Fixed Technical Qs           ├── 1. HR Questions (Question DB + Local NLP)
  ├── 0 Follow-ups             ├── 0 Follow-ups                 ├── 2. Subject/Skill Qs (Question DB + Local NLP)
  ├── 0 LLM Calls              ├── 0 LLM Calls                  ├── 3. Project Questions (✨ LLM Generated)
  └── Local NLP Evaluation     └── Local NLP Evaluation         └── 4. Dynamic Project Follow-ups (✨ LLM Generated & Evaluated)

📊 Summary of Interview Modes & Engine Allocation
Interview Mode	Question Source	Dynamic Follow-Ups?	Evaluation Engine	LLM Used?
Technical Interview	Predefined Question DB (OS, DBMS, OOP, DSA, CN)	❌ None	Local Concept NLP	❌ No (100% Free)
HR Interview	Predefined Question DB (Behavioral, Situational, STAR)	❌ None	Local Concept NLP	❌ No (100% Free)
Resume Interview	Multi-Track Hybrid:
• HR: Question DB
• Subjects: Question DB (matched to resume skills)
• Projects: LLM generated from resume project text	✅ Yes (2–3 Project Follow-ups only)	Hybrid:
• HR & Subjects: Local NLP
• Projects & Follow-ups: LLM Router	✅ Yes (Targeted to Projects Only)
🛠️ Step-by-Step Implementation Plan for this Flow
1. Resume Parser Enhancement (ai-services/nlp-service/resume_parser.py)
Parse uploaded resume into structured JSON:
json
{
  "detected_subjects": ["dbms", "os", "oops", "react"],
  "projects": [
    {
      "title": "E-Commerce Microservices",
      "tech_stack": ["Node.js", "Redis", "MongoDB", "Docker"],
      "description": "Built event-driven order and payment service with Redis pub/sub..."
    }
  ]
}
2. Session Question Assembly (backend/controllers/questionController.js)
When creating a Resume Session:
Pick HR Questions based on the number of questions selected from Question DB (tagged hr).
Pick Subject Questions based on number of questions from Question DB matching detected_subjects (e.g. DBMS, OOP).
Call LLM Router to generate 1–2 Project Core Questions from candidate's projects.
Tag each question with its track: track: "hr" | "subject" | "project".
3. Dynamic Live Follow-Up Handler (LiveInterviewPage.jsx + backend)
For hr and subject questions: Proceed directly to next question upon submission (no follow-up).
For project questions:
Submit answer $\rightarrow$ LLM assesses if a technical follow-up is needed (e.g., "How did you handle race conditions in Redis during checkout?").
Allows max 2–3 dynamic follow-ups, then transitions to the next section.
4. Evaluation Dispatcher (backend/services/analysisService.js)
If question.track === "hr" or "subject": Send transcript to nlp-service/analyze (Local NLP).
If question.track === "project": Send transcript to LLM Router with project context (LLM Evaluation).