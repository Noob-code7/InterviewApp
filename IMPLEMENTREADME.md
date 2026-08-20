# Comprehensive Repository Audit, Architecture Reconstruction & Recruiter-Grade README Creation

## Context

You are continuing work on my existing project, **InterviewAI**.

You already have the context from our previous conversations, but an important amount of development has happened outside this chat during the last several days using **OpenCode and other AI coding workflows**.

The last three days involved extensive implementation, debugging, architecture changes, testing, refactoring, interview-flow improvements, AI pipeline work, NLP improvements, conversational automation, and deployment preparation.

Therefore:

> **Do not rely solely on our previous conversation history.**

The **current repository is the ultimate source of truth**.

Your first responsibility is to deeply inspect and understand the project as it exists right now.

Do not assume that an older plan, implementation detail, architecture decision, or feature discussed earlier is still accurate. Verify everything against the actual codebase.

---

# Primary Objective

I want you to perform a **deep repository intelligence audit** and then create an exceptional, highly structured, visually understandable, recruiter-grade `README.md`.

The README should not feel like a basic GitHub project description.

A recruiter, developer, engineer, or technical interviewer should be able to open the repository and quickly understand:

1. What InterviewAI does.
2. Why it is technically interesting.
3. How the complete architecture works.
4. How the frontend, backend, AI services, NLP pipeline, database, storage, and analysis systems interact.
5. How the conversational interview automation works.
6. How microphone activity, interruption, barge-in, noise handling, answer completion, and automatic progression work.
7. How resume parsing and different interview modes work.
8. How technical answers are evaluated.
9. How local NLP evaluation works internally.
10. What AI models/services are used and what each one is responsible for.
11. What difficult engineering problems were solved.
12. How the entire system flows from a candidate starting an interview to receiving a final report.

The goal is that the README makes someone think:

> "This is significantly more sophisticated than a typical student CRUD project."

---

# CRITICAL RULE: AUDIT FIRST — DO NOT WRITE THE README IMMEDIATELY

Before editing or generating the final README, perform a complete audit of the repository.

I want you to mine the project deeply.

Do not just inspect top-level files.

Trace important functionality through the codebase.

Understand how data and control flow between components.

Read the implementation rather than guessing based on filenames.

---

# PHASE 1 — COMPLETE REPOSITORY DISCOVERY

Perform a structured sweep of the repository.

Inspect and understand:

* Root-level files.
* Existing `README.md` files.
* Documentation files.
* Architecture documents.
* Deployment documentation.
* Environment examples.
* Docker configuration.
* Docker Compose configuration.
* Backend.
* Frontend.
* Every AI service.
* Utility files.
* Middleware.
* Controllers.
* Routes.
* Database models.
* Services.
* Hooks.
* Context/state management.
* NLP logic.
* Question-selection logic.
* Resume parsing.
* Storage abstraction.
* Media processing.
* Authentication.
* Redis/BullMQ/queues if currently implemented.
* Background processing.
* Test files that reveal system behavior.
* Verification scripts.
* Deployment scripts.

Also inspect the existing README and documentation files before replacing or restructuring anything.

Extract useful information from them, but verify their claims against the actual implementation.

If documentation and code disagree:

> **The current implementation wins.**

Do not document features as implemented unless you can verify them.

---

# PHASE 2 — ARCHITECTURE RECONSTRUCTION

Before writing the README, reconstruct the entire architecture.

Create an internal understanding of the following.

## 1. High-Level System Architecture

Trace the complete flow between:

* Candidate browser.
* React frontend.
* Node.js/Express backend.
* Face AI service.
* Voice AI service.
* NLP AI service.
* Database.
* Redis and queues if currently active.
* Object storage / media storage.
* External APIs.
* Authentication system.
* Report generation pipeline.

Determine:

* Which services communicate with which.
* Which requests are synchronous.
* Which operations are asynchronous.
* Where media is uploaded.
* Where it is stored.
* Where analysis occurs.
* How results are returned.
* How final reports are generated.

The final README should include a **clear visual architecture diagram**, preferably using Mermaid where appropriate.

The architecture should be understandable at a glance.

---

# PHASE 3 — DEEP FEATURE MINING

I do not want a superficial feature list.

Mine every important function and subsystem.

Identify all meaningful user-facing and technical features.

At minimum, deeply investigate the following areas.

---

## A. Interview Modes

Determine all currently implemented interview modes.

For example, inspect whether the project supports things such as:

* Default technical interviews.
* Subject-specific interviews.
* Resume-based interviews.
* Project-based interviews.
* Follow-up questions.
* Mixed/custom interview flows.

Do not assume these exist exactly as described.

Inspect the implementation and document only what actually exists.

Explain:

* How each mode is selected.
* How questions are generated or selected.
* How context is passed between systems.
* How follow-up logic works.
* How project or resume context influences questioning.

---

## B. Question Selection and Question Diversity

Inspect the complete question-selection system.

I know the project contains large question banks across subjects such as operating systems, DBMS, software engineering, and others.

Investigate:

* How questions are stored.
* How questions are selected.
* How randomness/diversity works.
* Whether previously asked questions are tracked per user.
* Whether the system prevents repeated questions.
* How subject/category filtering works.
* How follow-up questions are handled.

Explain the actual implementation clearly.

---

# C. Conversational Interview Engine

This is one of the most important parts of the project.

I want you to deeply understand and explain the interview conversation system.

Investigate the complete lifecycle:

```text
Candidate enters interview
        ↓
AI greeting
        ↓
Candidate interaction
        ↓
First question
        ↓
Candidate answer
        ↓
Answer completion detection
        ↓
Analysis/upload
        ↓
Conversational transition
        ↓
Next question
        ↓
Repeat until interview completion
        ↓
Processing
        ↓
Final report
```

But do not merely reproduce this diagram.

Trace the actual implementation.

Understand the state machine, flags, refs, lifecycle guards, generation IDs, timers, callbacks, and race-condition protection currently present.

Explain how the system handles:

* Greeting.
* Greeting response.
* Question delivery.
* Candidate listening.
* Candidate speaking.
* Answer completion.
* Automatic transition.
* Final-question completion.
* Processing.
* Cleanup.

---

# D. Candidate Barge-In / Mid-Question Interruption

This is one of the most technically interesting features and must receive special attention.

Understand exactly how the system currently works.

The intended conversational behavior is roughly:

```text
AI is speaking a question
        ↓
Candidate begins speaking
        ↓
System detects genuine candidate speech
        ↓
AI audio stops
        ↓
System determines the conversational context
        ↓
Candidate continues the relevant answer
        ↓
Answer completes
        ↓
AI acknowledges
        ↓
Interview continues correctly
```

However, do not document the intended design blindly.

Inspect the current implementation and explain the behavior that is actually implemented.

Investigate:

* VAD.
* RMS thresholds.
* Sustained speech detection.
* Speech recognition.
* Barge-in detection.
* Noise rejection.
* Candidate speech confirmation.
* TTS cancellation.
* Generation IDs.
* Race-condition prevention.
* Interrupted-question context association.
* Previous-answer continuation behavior.
* Question replay/recovery.
* Delay before recovery/replay.
* Transition phrase interruption behavior.
* Multiple barge-ins.
* False interruption handling.

The README should communicate why this is more complex than simply calling a text-to-speech function.

Explain the real engineering challenge:

> A conversational interview is not simply "play audio → record answer."

It requires managing asynchronous microphone input, browser speech recognition, TTS playback, timers, state transitions, interruptions, stale callbacks, race conditions, and conversational context.

---

# E. Microphone Sensitivity and Noise Handling

This must be clearly documented.

I tested the application in a real home environment with:

* Cars.
* Traffic noise.
* Car horns.
* Environmental sounds.
* General background noise.

Therefore, investigate the actual microphone and noise-handling implementation.

Explain:

* How microphone activity is detected.
* What thresholds or filtering mechanisms currently exist.
* How sustained speech is distinguished from short noise.
* How false interruptions are reduced.
* How the system avoids automatically progressing due to ambient noise.
* How the system determines whether a candidate has genuinely started answering.
* How answer completion is detected after speech stops.

Do not claim that the system is "100% immune" to noise unless the implementation and evidence genuinely support that.

Be technically honest.

If the implementation uses a hybrid of acoustic detection and speech/transcript confirmation, explain that clearly.

---

# F. Automatic Answer Completion and Question Progression

Investigate the automation carefully.

The candidate should not need to manually press "Next" under normal conversational flow.

Trace:

* How the system knows an answer has started.
* How silence is measured.
* How minimum answer duration is handled.
* How grace periods work.
* How duplicate completion events are prevented.
* How the next-question transition is triggered.
* How upload/analysis completion interacts with progression.
* How final-question behavior differs.
* How race conditions are prevented.

Explain the engineering challenge of avoiding:

* Premature advancement.
* Advancing because of background noise.
* Never advancing after an answer.
* Duplicate transitions.
* Multiple VAD callbacks.
* Stale state between questions.

---

# G. NLP Answer Evaluation System

This section should be deep and technically impressive.

I specifically want you to inspect and explain the **local NLP evaluation system**.

Do not simply write:

> "We use NLP to analyze answers."

I want you to investigate the actual implementation.

Trace:

* How the transcript enters the NLP service.
* How answers are mapped to questions.
* How the expected answer or concepts are represented.
* How semantic similarity is measured.
* How important technical concepts are detected.
* How missing concepts are penalized.
* How incorrect or sarcastic answers are handled.
* How scoring works.
* Whether multiple scoring signals are combined.
* How thresholds work.
* How strictness differs across question types.
* How the newly added questions were integrated into the NLP system.
* How the system was strengthened to avoid high scores for clearly wrong answers.

If there are heuristics, embeddings, keyword/concept matching, semantic models, contradiction penalties, coverage scoring, or any other mechanisms, explain the real architecture in detail.

The goal is to show that the project does not simply send everything to an LLM and ask:

> "Was this answer good?"

Explain the locally implemented evaluation logic and why it exists.

---

# H. Technical / Semantic Evaluation Through APIs

Investigate any external model or API integration used for technical evaluation.

Explain:

* Which API/provider is used.
* What information is sent.
* What the API evaluates.
* Whether it is used for follow-up questions, project questions, technical depth, semantic evaluation, or another purpose.
* How its output integrates with the local NLP pipeline.
* Why a hybrid architecture was chosen.

Do not expose API keys, secrets, private URLs, or sensitive environment variables.

---

# I. Real-Time Voice Analysis

Identify the actual voice-analysis models and libraries.

Explain:

* Which models are used.
* What they analyze.
* Whether they evaluate confidence, tone, speech characteristics, pacing, clarity, or other metrics.
* How audio is captured.
* How it is chunked or processed.
* How the results enter the final report.

Do not invent metrics.

Only document metrics that the code actually produces.

---

# J. Real-Time Face / Video Analysis

Investigate the face-analysis pipeline.

Determine:

* Which model(s) or libraries are used.
* What facial/emotional signals are analyzed.
* How video is captured.
* How frames or clips are sampled.
* How analysis is performed.
* How results are aggregated.
* How the final report uses them.

Again, explain the actual implementation rather than generic DeepFace documentation.

---

# K. Resume Parser and Resume-Based Interviewing

Mine the resume pipeline in detail.

Explain:

* Supported file formats.
* How resumes are uploaded.
* How files are extracted.
* How text is parsed.
* What information is extracted.
* How projects, skills, technologies, or subjects influence interview questions.
* How project-specific follow-up questions are generated.
* How resume context flows through the backend and AI systems.

This should be a meaningful feature section, not a one-line bullet point.

---

# L. Report Generation

Trace the entire report pipeline.

Explain how the project combines available signals such as:

```text
Technical Answer Quality
        +
Local NLP Evaluation
        +
External Semantic / Technical Evaluation
        +
Voice Analysis
        +
Facial Analysis
        ↓
Comprehensive Interview Report
```

Only include signals that actually exist.

Explain:

* How results are stored.
* How individual scores are calculated.
* How results are aggregated.
* How the frontend displays them.
* How reports are retrieved.

Include screenshots placeholders for the final report.

---

# M. Media Storage and Processing

Investigate:

* Video/audio upload flow.
* Storage abstraction.
* Local vs cloud storage support.
* Object retrieval.
* Analysis pipeline access to media.
* Cleanup behavior.
* Session media lifecycle.
* Storage-related fixes that were implemented.

Explain the abstraction cleanly without exposing private infrastructure.

---

# N. Authentication and User History

Investigate the current authentication system.

Determine:

* Registration/login flow.
* JWT/session handling.
* Refresh tokens if implemented.
* Email verification if implemented.
* User-specific interview history.
* Session ownership.
* Question history tracking.

Only document what is actually implemented.

---

# O. Background Jobs, Redis, and Queues

If the repository currently uses Redis, BullMQ, or any queue-based architecture, investigate it thoroughly.

Explain:

* Why asynchronous processing is needed.
* Which tasks are queued.
* How jobs are processed.
* How failures/retries work if implemented.
* How concurrency is controlled.

Do not document planned architecture as completed architecture.

---

# P. TTS / Voice Delivery

Inspect the current implementation carefully.

Determine what is actually being used right now.

This is especially important because multiple TTS approaches were discussed during development, including browser `speechSynthesis` and Kokoro-related plans.

Do not document a planned TTS architecture as implemented.

Inspect the current code and explain:

* Current TTS engine.
* Voice playback mechanism.
* Cancellation mechanism.
* How barge-in stops speech.
* Any fallback mechanism.
* Any caching or prefetching if actually implemented.

---

# PHASE 4 — MINE IMPORTANT FUNCTIONS, NOT JUST FILES

Do not only describe directories.

Trace important functions.

For each major subsystem, identify the important functions, hooks, services, controllers, and state-management logic that make the feature work.

You do not need to list every helper function in the README.

Instead, identify the functions that demonstrate meaningful engineering work.

Examples of the kind of investigation I expect:

```text
Question lifecycle controller
        ↓
TTS playback function
        ↓
VAD activation
        ↓
Candidate speech detection
        ↓
Answer recording/transcript handling
        ↓
Completion detection
        ↓
Media upload
        ↓
Analysis pipeline
        ↓
Transition controller
        ↓
Next question
```

Follow the actual implementation.

Where appropriate, use simplified diagrams in the README rather than dumping source code.

---

# PHASE 5 — READ ALL EXISTING README AND DOCUMENTATION FILES

Before creating the new main README:

1. Read every existing README.
2. Read architecture documentation.
3. Read deployment documentation.
4. Read verification/testing documentation.
5. Read service-level documentation.

Use these documents to understand historical decisions.

However:

> Verify important claims against the current implementation.

If an old README claims something that is no longer true, do not repeat it.

---

# PHASE 6 — CREATE THE NEW RECRUITER-GRADE README

After the audit is complete, create a polished root-level `README.md`.

The README should be professional, visually structured, technically accurate, and enjoyable to navigate.

Use strong section hierarchy.

Recommended structure:

---

# InterviewAI

A strong one-paragraph explanation.

Then immediately include a visual screenshot placeholder.

```markdown
<!-- ============================================================ -->
<!-- SCREENSHOT: HERO / LIVE INTERVIEW INTERFACE                  -->
<!-- Replace this comment with your image when available          -->
<!-- ============================================================ -->

[ PLACE HERO SCREENSHOT HERE ]
```

Do not use a broken image link.

Leave obvious, well-labelled placeholders so I can insert screenshots manually later.

---

## Why InterviewAI?

Explain what makes this more than a typical interview-question application.

Highlight:

* Real-time AI interview simulation.
* Conversational automation.
* Candidate interruption.
* Automatic answer progression.
* Multi-modal analysis.
* Local NLP.
* Resume-aware questioning.
* Project-based technical follow-ups.
* Distributed service architecture.

---

## Experience the Interview Flow

Create a visually understandable flow.

For example:

```text
Enter Interview
      ↓
AI Greets Candidate
      ↓
Question Delivery
      ↓
Candidate Can Interrupt AI
      ↓
AI Stops and Handles Active Context
      ↓
Candidate Answers
      ↓
Speech + Silence Detection
      ↓
Automatic Answer Completion
      ↓
Multi-Stage AI Analysis
      ↓
Conversational Transition
      ↓
Next Question
      ↓
Final Performance Report
```

Adapt this to the real implementation.

---

## Screenshots / Product Tour

Create placeholders for screenshots.

For example:

```markdown
### 1. Interview Setup

<!-- SCREENSHOT PLACEHOLDER:
     Insert Interview Setup screenshot here -->

---

### 2. Live AI Interview

<!-- SCREENSHOT PLACEHOLDER:
     Insert Live Interview screenshot here -->

---

### 3. Candidate Speaking / Real-Time Interaction

<!-- SCREENSHOT PLACEHOLDER:
     Insert microphone / active speaking UI screenshot here -->

---

### 4. Interview Processing

<!-- SCREENSHOT PLACEHOLDER:
     Insert processing screen screenshot here -->

---

### 5. Final Performance Report

<!-- SCREENSHOT PLACEHOLDER:
     Insert report screenshot here -->
```

Leave the actual insertion to me.

Make it extremely obvious where each image belongs.

---

# Architecture

Include a clean Mermaid diagram representing the actual system.

For example:

```text
Candidate Browser
       │
       ▼
React Frontend
       │
       ▼
Node.js / Express API
 ┌─────┼───────────────┐
 ▼     ▼               ▼
Face  Voice           NLP
 AI     AI             AI
 │      │              │
 └──────┼──────────────┘
        ▼
 Database / Storage
```

But create the diagram based on the actual repository architecture.

Include:

* Frontend.
* Backend.
* AI microservices.
* Database.
* Storage.
* Redis/queues if actually active.
* External APIs if relevant.

Also create a separate diagram for the **analysis pipeline** if useful.

---

# The Conversational Interview Engine

This should be one of the strongest sections.

Explain the problem:

A typical interview application works like:

```text
Question → User clicks record → User clicks next
```

InterviewAI attempts to create a more natural experience.

Explain the implemented lifecycle:

```text
AI speaks
    ↓
Candidate can remain silent
    ↓
OR candidate can interrupt
    ↓
AI speech stops
    ↓
Candidate continues the relevant answer
    ↓
Answer completion is detected
    ↓
AI acknowledges/transitions
    ↓
Next question begins automatically
```

Explain the engineering behind this.

Include diagrams where useful.

---

# Barge-In: When the Candidate Interrupts the AI

Explain the feature clearly and honestly.

Include the actual pipeline, such as:

```text
Microphone Input
      ↓
Voice Activity Detection
      ↓
Speech / Noise Validation
      ↓
Barge-In Confirmed
      ↓
Cancel AI Playback
      ↓
Preserve Conversation Context
      ↓
Candidate Continues Speaking
```

Explain:

* Why raw microphone volume alone is unreliable.
* How the implementation attempts to reduce false positives.
* How environmental noise is handled.
* How asynchronous browser events create race conditions.
* How generation IDs, refs, locks, or other mechanisms prevent stale audio/state if they actually exist.

This section should demonstrate real engineering complexity without exaggeration.

---

# Automatic Answer Completion

Explain:

* Candidate starts speaking.
* System recognizes genuine answer activity.
* Silence/completion logic activates.
* Answer is finalized.
* Duplicate completion events are prevented.
* Processing/analysis occurs.
* Interview progresses automatically.

Explain why separating:

```text
Waiting for Candidate
```

from:

```text
Candidate Is Actively Answering
```

matters, if that distinction exists in the implementation.

---

# The NLP Evaluation Engine

This should be a detailed technical section.

Explain the real local NLP architecture.

Use diagrams.

For example, if accurate:

```text
Candidate Transcript
        ↓
Question Context
        ↓
Text Normalization
        ↓
Concept / Keyword Extraction
        ↓
Semantic Comparison
        ↓
Expected Concept Coverage
        ↓
Incorrect / Missing Concept Detection
        ↓
Scoring
```

Replace this with the actual implementation.

Explain why the local system was necessary.

Explain how the project avoids simply giving high scores to:

* Very short answers.
* Generic answers.
* Incorrect answers.
* Sarcastic answers.
* Answers containing superficial keywords but missing technical understanding.

Explain the question-bank expansion and how evaluation coverage was improved for newer questions, if implemented.

---

# Multi-Modal AI Analysis

Create a clear section for the multiple analysis tracks.

For example:

```text
                    Interview Session
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
      Face Analysis    Voice Analysis    NLP Analysis
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                   Result Aggregation
                           │
                           ▼
                    Final Report
```

Then explain each track.

Only document models and metrics actually present.

---

# Resume Intelligence

Explain:

```text
Resume Upload
      ↓
Document Parsing
      ↓
Structured Information Extraction
      ↓
Skills / Projects / Technologies
      ↓
Interview Context
      ↓
Personalized Questions
      ↓
Project-Specific Follow-Ups
```

Adapt to the real code.

Explain the complexity of connecting resume information to interview generation.

---

# Interview Modes

Create a clear table based on the modes actually implemented.

Example:

| Mode              | Context Source    | Question Strategy   |
| ----------------- | ----------------- | ------------------- |
| Default Technical | Selected subjects | Question bank       |
| Resume-Based      | Parsed resume     | Personalized        |
| Project-Based     | Project context   | Follow-up questions |

Do not use this exact table if the implementation differs.

---

# Question Intelligence and Diversity

Explain:

* Question banks.
* Subject coverage.
* Random selection.
* Avoiding repeated questions.
* User question history if implemented.
* Follow-up questions.

Include actual counts only if verified from the current data.

---

# Data and Media Flow

Create a clear visual explanation:

```text
Browser Capture
      ↓
Session Media
      ↓
Storage Layer
      ↓
AI Services
      ↓
Analysis Results
      ↓
Database
      ↓
Report
```

Explain the actual storage abstraction and lifecycle.

---

# Tech Stack

Create a visually clean technology table grouped by purpose:

### Frontend

### Backend

### AI / ML

### NLP

### Database

### Queue / Caching

### Storage

### Deployment

### Development Tools

Only include technologies currently present.

---

# Key Engineering Challenges

This section is extremely important.

Do not write generic statements such as:

> "Building this project was challenging."

Instead, explain real engineering problems solved.

Potential examples, only if verified:

### 1. Synchronizing AI Speech With Candidate Speech

Explain asynchronous TTS, microphone input, VAD, speech recognition, cancellation, and stale callback problems.

### 2. Preventing False Barge-Ins

Explain environmental noise and microphone sensitivity.

### 3. Maintaining Question Context During Interruption

Explain how interrupted speech must not accidentally associate the candidate's answer with the wrong question.

### 4. Preventing Duplicate or Skipped Questions

Explain state leakage and race conditions between question transitions.

### 5. Making NLP Strict Enough for Technical Answers

Explain why semantic similarity alone can produce false high scores.

### 6. Coordinating Multiple AI Services

Explain service boundaries, media flow, analysis timing, and result aggregation.

Use the actual problems found in the repository.

---

# Project Structure

Create a clean simplified tree.

Do not dump irrelevant files.

For example:

```text
InterviewAI/
│
├── frontend/                 # Candidate application
├── backend/                  # API gateway and business logic
│
├── ai-services/
│   ├── face-service/         # Facial analysis
│   ├── voice-service/        # Voice/audio analysis
│   └── nlp-service/          # Technical answer evaluation
│
├── scripts/                  # Deployment and automation
├── docs/                     # Architecture and verification docs
└── docker-compose.yml
```

Adapt to the actual structure.

---

# Running the Project

Provide clean setup instructions.

Include:

1. Clone.
2. Environment configuration.
3. Required services.
4. Local development.
5. Docker deployment if implemented.

Do not expose secrets.

Use `.env.example`.

---

# Testing and Verification

Inspect the actual test scripts.

Document meaningful verification commands.

Separate:

* Unit/component tests.
* Integration tests.
* End-to-end tests.
* Manual browser/lab verification.

Be honest about what is automated and what requires physical microphone/browser testing.

Do not claim all tests prove browser behavior if they are simulations.

---

# Deployment

Describe the actual supported deployment architecture.

If cloud deployment is not yet fully implemented or verified, label it appropriately.

Separate:

```text
Currently Verified
```

from:

```text
Planned / Deployment Target
```

Do not present future deployment plans as completed production infrastructure.

---

# Future Improvements

Keep this realistic.

Only include meaningful future work.

Potential examples:

* Further noise robustness.
* Streaming TTS.
* Scaling microservices independently.
* More interview domains.
* Improved personalized questioning.
* More advanced neural VAD.

But do not make this section too large.

---

# Development Journey / Engineering Note

Add a short, professional section explaining that the project evolved through iterative real-world testing.

Mention the importance of testing in actual environments:

* Real microphone input.
* Environmental noise.
* Browser timing.
* Candidate interruptions.
* Multi-question lifecycle behavior.

Do not make it sound like excuses.

Frame it as engineering iteration:

> Real-world testing exposed problems that simulated tests could not fully capture, particularly around browser audio lifecycles, microphone noise, asynchronous state transitions, and conversational interruptions.

This demonstrates engineering maturity.

---

# README STYLE REQUIREMENTS

The final README must:

* Be visually attractive.
* Be easy to scan.
* Use strong headings.
* Use tables where useful.
* Use Mermaid diagrams where GitHub supports them.
* Use icons/emojis sparingly and professionally.
* Avoid giant walls of text.
* Avoid generic AI-generated language.
* Avoid excessive marketing claims.
* Avoid saying "revolutionary" or "world-class."
* Avoid fake performance claims.
* Avoid claiming 100% accuracy unless verified.
* Clearly distinguish implemented features from planned features.
* Be technically accurate.

The README should feel like it was written by someone who deeply understands the architecture.

---

# SCREENSHOT PLACEHOLDER REQUIREMENT

I will manually add screenshots later.

Therefore, do NOT invent image paths.

Do NOT use placeholder URLs.

Instead, leave highly visible markers exactly where screenshots should go.

Example:

```markdown
<!-- 📸 SCREENSHOT PLACEHOLDER
     Suggested image: Live Interview Interface
     Insert image here:
-->
```

Use these placeholders throughout the README.

Suggested screenshot locations:

1. Hero / live interview screen.
2. Interview setup.
3. Candidate speaking / microphone interaction.
4. AI question interface.
5. Processing screen.
6. Final performance report.
7. Any other highly visual feature worth showing.

Do not overuse screenshots.

Approximately 5–7 well-positioned placeholders is enough.

---

# IMPORTANT: DO NOT DELETE OR MODIFY FUNCTIONAL CODE

For this task, the main goal is repository understanding and documentation.

Do not modify application logic.

Do not refactor working functionality.

Do not delete files.

Do not clean up the repository during this task unless I explicitly request that later.

Your job right now is:

```text
UNDERSTAND EVERYTHING
        ↓
VERIFY THE IMPLEMENTATION
        ↓
RECONSTRUCT THE ARCHITECTURE
        ↓
IDENTIFY THE REAL FEATURES
        ↓
CREATE THE BEST POSSIBLE README
```

---

# EXECUTION PROCESS

Follow this exact sequence.

## Step 1 — Repository Audit

Inspect the entire project.

Read source files, documentation, configuration, tests, and service implementations.

## Step 2 — Architecture Summary

Before editing the README, provide me with a structured summary containing:

1. Current architecture.
2. All major subsystems.
3. Interview modes.
4. Conversational automation flow.
5. Barge-in implementation.
6. Microphone/noise handling.
7. NLP pipeline.
8. Face analysis pipeline.
9. Voice analysis pipeline.
10. Resume pipeline.
11. External APIs.
12. Database/storage architecture.
13. Background processing.
14. Current TTS implementation.
15. Features that are implemented.
16. Features that are planned but not implemented.
17. Documentation inaccuracies, if any.

## Step 3 — README Plan

Then provide the exact proposed README structure.

Tell me:

* Sections.
* Diagrams.
* Screenshot placeholder locations.
* Important technical stories to highlight.

## Step 4 — WAIT FOR MY APPROVAL

Do not edit `README.md` yet.

Wait for my approval after presenting:

1. Your repository findings.
2. Architecture reconstruction.
3. README outline.

Only after I approve should you generate and write the final README.

The final README should make the architecture **visual, understandable, technically impressive, and honest**.

Do not undersell the complexity of the work—but do not exaggerate anything that is not actually implemented.
