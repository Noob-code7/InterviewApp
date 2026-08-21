# Documentation Structure Plan for InterviewAI

The previous task focuses on deeply auditing the repository and creating a recruiter-grade main `README.md`.

This is a separate documentation task.

## Objective

After understanding the complete repository architecture, I want you to design and maintain a **clean, scalable documentation structure** for InterviewAI.

Do **not** put every technical detail into one massive `README.md`.

The root README should remain the primary entry point for recruiters, developers, and anyone visiting the GitHub repository. Deep technical explanations should be organized into separate documentation files.

---

# Important Rule

Before creating, moving, deleting, or rewriting any documentation:

1. Inspect all existing README and documentation files.
2. Identify which documentation is still accurate.
3. Identify duplicate, outdated, contradictory, or corrupted documentation.
4. Verify documentation claims against the current codebase.
5. Do not delete useful historical or technical documentation without first determining whether its content should be preserved elsewhere.

The **current implementation is the source of truth**.

Do not document planned features as implemented features.

---

# Proposed Documentation Structure

Use the following structure as the starting point, but adapt it if the actual repository architecture suggests a better organization:

```text
InterviewAI/
│
├── README.md
│
├── docs/
│   │
│   ├── ARCHITECTURE.md
│   ├── CONVERSATIONAL_ENGINE.md
│   ├── NLP_ENGINE.md
│   ├── AI_PIPELINES.md
│   ├── RESUME_INTELLIGENCE.md
│   ├── STORAGE_AND_MEDIA.md
│   ├── TESTING_AND_VERIFICATION.md
│   ├── DEPLOYMENT.md
│   └── API.md
│
├── frontend/
├── backend/
├── ai-services/
└── ...
```

This is not a requirement to create unnecessary files.

If a subject is too small to justify its own document, combine it logically with another document.

Avoid documentation fragmentation.

---

# Documentation Responsibilities

## `README.md` — Project Showcase and Entry Point

The root README should focus on:

* What InterviewAI is.
* Why it is technically interesting.
* Demo video placeholder.
* Product screenshots placeholders.
* Major features.
* High-level architecture.
* High-level interview flow.
* Barge-in/conversational interaction overview.
* Multi-modal analysis overview.
* NLP overview.
* Resume intelligence overview.
* Tech stack.
* Simplified project structure.
* Quick setup.
* Links to detailed documentation.

The README should **summarize and visually explain**.

It should not become a 2,000-line technical specification.

---

## `docs/ARCHITECTURE.md`

This should contain the complete technical architecture.

Include:

* Frontend architecture.
* Backend architecture.
* AI microservices.
* Database.
* Storage.
* Redis/queues if implemented.
* External APIs.
* Service communication.
* Request/data flow.
* System diagrams.
* Analysis pipeline diagrams.

This is the document for someone who wants to deeply understand how the entire system fits together.

---

## `docs/CONVERSATIONAL_ENGINE.md`

Document the conversational interview system in depth.

Include only features verified in the implementation, such as:

* Interview state lifecycle.
* Greeting.
* Question delivery.
* Candidate listening.
* Voice activity detection.
* Candidate barge-in.
* TTS cancellation.
* Noise handling.
* Speech confirmation.
* Context association.
* Interrupted-answer continuation.
* Question recovery/replay.
* Answer completion.
* Silence detection.
* Automatic progression.
* Race-condition prevention.
* Generation IDs, refs, locks, or lifecycle guards where relevant.

Use sequence diagrams and state diagrams where helpful.

This document should explain why conversational automation is technically more complicated than:

```text
Play question → record answer → next button
```

---

## `docs/NLP_ENGINE.md`

Document the local NLP evaluation architecture.

Investigate and explain the actual implementation, including:

* Transcript processing.
* Question-answer mapping.
* Expected concepts.
* Technical concept detection.
* Semantic evaluation.
* Keyword/concept coverage.
* Missing concept penalties.
* Incorrect-answer detection.
* Scoring.
* Strictness mechanisms.
* Handling of newly added question-bank questions.
* How the system avoids rewarding generic or clearly incorrect answers.

Include diagrams showing the evaluation pipeline.

Do not expose proprietary prompts, secrets, API keys, or unnecessary implementation internals.

---

## `docs/AI_PIPELINES.md`

Document the AI analysis services.

Organize it into:

### Face Analysis

* Input.
* Processing.
* Models/libraries actually used.
* Sampling strategy.
* Aggregation.
* Output metrics.

### Voice Analysis

* Input.
* Processing.
* Models/libraries actually used.
* Audio handling.
* Output metrics.

### NLP Analysis

Provide a concise reference and link to `NLP_ENGINE.md`.

### Result Aggregation

Explain how the available analysis signals contribute to the final interview report.

---

## `docs/RESUME_INTELLIGENCE.md`

Document:

* Resume upload.
* Supported formats.
* Parsing.
* Information extraction.
* Skills and technology extraction.
* Project extraction.
* Resume-based interviews.
* Project-specific questioning.
* Follow-up generation.

Trace the actual data flow from resume upload to personalized interview questions.

---

## `docs/STORAGE_AND_MEDIA.md`

Document:

* Media capture.
* Upload flow.
* Storage abstraction.
* Local storage behavior.
* Cloud/object storage behavior, if implemented.
* Retrieval for AI analysis.
* Session media lifecycle.
* Cleanup.
* Retention, if implemented.

Clearly separate verified functionality from future cloud deployment plans.

---

## `docs/TESTING_AND_VERIFICATION.md`

Create an honest testing document.

Separate:

### Automated Tests

Document:

* Unit tests.
* Integration tests.
* API tests.
* Regression scripts.
* E2E tests.

### Browser / Physical Testing

Document features that require real-world verification:

* Microphone input.
* Barge-in.
* Noise rejection.
* TTS cancellation.
* Automatic answer completion.
* Multi-question progression.

### Simulated Tests

Clearly label synthetic or simulated benchmarks.

Never represent simulated benchmark numbers as physical measurements.

Include the current verification status of major systems where appropriate:

```text
VERIFIED
PARTIALLY VERIFIED
NOT VERIFIED
FAILED
```

---

## `docs/DEPLOYMENT.md`

Document the actual deployment process.

Organize it into logical sections such as:

### Development Environment

### Docker Deployment

### Cloud Deployment

### College / LAN Self-Hosting

### Environment Variables

### External Services

### Operational Notes

Do not claim a deployment path is production-tested unless it has actually been verified.

Clearly distinguish:

* Implemented.
* Tested.
* Planned.

---

## `docs/API.md` — Only If Justified

Create this only if the project has enough meaningful API surface to justify it.

If created, document the important endpoints:

* Authentication.
* Interview/session lifecycle.
* Resume upload.
* Analysis.
* Report retrieval.
* Other important public/internal API boundaries.

Do not document every trivial endpoint.

Do not expose secrets.

---

# Documentation Navigation

The root README should include a section like:

```markdown
## 📚 Documentation

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Complete system architecture and service communication |
| [Conversational Engine](docs/CONVERSATIONAL_ENGINE.md) | Barge-in, VAD, answer completion, and interview automation |
| [NLP Engine](docs/NLP_ENGINE.md) | Technical answer evaluation and scoring |
| [AI Pipelines](docs/AI_PIPELINES.md) | Face, voice, and NLP analysis services |
| [Resume Intelligence](docs/RESUME_INTELLIGENCE.md) | Resume parsing and personalized interviewing |
| [Testing](docs/TESTING_AND_VERIFICATION.md) | Automated, integration, and real-world verification |
| [Deployment](docs/DEPLOYMENT.md) | Local, cloud, and self-hosted deployment |
```

Only link to documents that actually exist.

Every documentation file should also link back to the main README where appropriate.

---

# Avoid Documentation Duplication

Do not copy the same explanation across multiple documents.

For example:

* README = concise overview of NLP.
* `NLP_ENGINE.md` = detailed implementation explanation.

Similarly:

* README = high-level architecture.
* `ARCHITECTURE.md` = complete architecture and data flow.

The documentation should form a hierarchy:

```text
README
   │
   ├── Quick understanding
   │
   └── Detailed documentation
           │
           ├── Architecture
           ├── Conversational Engine
           ├── NLP
           ├── AI Pipelines
           ├── Resume Intelligence
           ├── Storage
           ├── Testing
           └── Deployment
```

---

# Documentation Quality Rules

Every document must:

* Be based on the current repository implementation.
* Be technically accurate.
* Clearly distinguish verified features from plans.
* Avoid generic AI-generated filler.
* Use diagrams when they improve understanding.
* Avoid unnecessary duplication.
* Be easy to navigate.
* Use consistent terminology across all documents.
* Use consistent names for services, states, pipelines, and features.
* Avoid exposing secrets or private configuration.
* Avoid documenting dead code as active functionality.

---

# Existing Documentation Cleanup

Do not immediately delete old documentation.

First produce a documentation audit containing:

| File         | Current Status     | Action            |
| ------------ | ------------------ | ----------------- |
| Example file | Accurate           | Keep              |
| Example file | Partially outdated | Update            |
| Example file | Duplicate          | Merge/redirect    |
| Example file | Obsolete           | Archive or remove |

For each file, explain the reason.

If multiple documents describe the same feature differently, reconcile them based on the current implementation.

---

# Execution Order

Follow this exact process:

## Step 1 — Documentation Audit

Inspect all existing documentation and README files.

Provide:

* Current files.
* Purpose.
* Accuracy.
* Duplicates.
* Outdated information.
* Missing documentation.

## Step 2 — Proposed Final Documentation Map

Show me the exact proposed final structure.

Explain why each document exists.

Do not create unnecessary documentation files.

## Step 3 — Content Ownership Plan

Explain what belongs in:

* Main README.
* Each detailed document.

Ensure there is minimal duplication.

## Step 4 — WAIT FOR MY APPROVAL

Do not create, delete, move, or rewrite documentation yet.

First show me:

1. Documentation audit.
2. Proposed folder structure.
3. Which existing files should be kept, merged, updated, archived, or removed.
4. What each final document will contain.

Wait for my approval.

Only after approval should you implement the documentation structure.

The final goal is a repository where:

* A recruiter can understand the project in 2 minutes through `README.md`.
* A developer can understand the architecture in 10–20 minutes.
* Someone deeply interested in the engineering can navigate into individual technical documents without reading one enormous README.
