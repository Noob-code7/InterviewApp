---
id: 05-PLAN-microservices
wave: 1
depends_on:
  - 04-PLAN-live-interface
files_modified:
  - backend/services/analysisService.js
  - backend/routes/analysis.js
  - backend/app.js
  - ai-services/face-service/main.py
  - ai-services/voice-service/main.py
  - frontend/src/pages/ProcessingPage.jsx
autonomous: true
requirements:
  - REQ-ai-analysis
---

# Plan: AI Analysis Microservices Architecture

## Goal
Establish the background job processing flow in Node.js and define the strict input/output contracts for the Python FastAPI microservices, preparing them to host the actual ML models later.

## Tasks

<task id="10.1">
  <title>Refine Python Microservice Schemas</title>
  <action>
    Update `ai-services/face-service/main.py` and `ai-services/voice-service/main.py`:
    - Ensure their response schemas perfectly match `faceAnalysisSchema` and `voiceAnalysisSchema` defined in the Mongoose Session model.
    - Set up placeholder processing logic that accepts the WebM file, sleeps to simulate ML processing, and returns the mock schema.
  </action>
</task>

<task id="10.2">
  <title>Create Node.js Background Analysis Service (BullMQ + Redis)</title>
  <action>
    Create `backend/services/analysisService.js` utilizing `bullmq` and Redis:
    - Set up a Redis connection and a BullMQ Queue (`analysis-queue`) and Worker. Add retry logic with exponential backoff for Redis connections. If Redis is unavailable during job enqueueing, return 503 Service Unavailable, set `session.jobStatus` to a failed state, and log errors. Ensure Worker logs/fails gracefully if Redis remains unreachable.
    - Add idempotency and crash-recovery by introducing `session.jobStatus` (queued|processing|completed|failed) in the DB. Configure the queue/Worker with a jobTimeout (e.g., 5 minutes) and retry strategy (maxAttempts: 3, backoff 1000/2000/4000ms), and create a dead-letter queue (`analysis-queue-dlq`) for exhausted retries. Update job failure handler to set `session.jobStatus` and `session.status='failed'` with error messages.
    - The worker processes a job containing a `sessionId`, loops through all answers, and validates/sanitizes file paths before reading. Explicit rules: normalize candidate paths, verify they reside under the expected upload directory (reject if outside), reject any path containing '..' or starting with '/', confirm the file exists and is readable before sending, and validate the extension is exactly '.webm' (case-insensitive). Violations are treated as errors and abort the request.
    - Send files via Axios using environment variables `process.env.FACE_SERVICE_URL` and `process.env.VOICE_SERVICE_URL`.
    - Include explicit Axios timeout of 45s, treating non-2xx status as errors.
    - Persist intermediate results to the DB after each answer is processed so partial progress is saved.
    - On full success, set `jobStatus='completed'` and `session.status='completed'`.
  </action>
</task>

<task id="10.3">
  <title>Create Analysis Trigger API</title>
  <action>
    Create `backend/routes/analysis.js` (mount at `/api/analysis`):
    - `POST /api/analysis/:sessionId/start`: Triggers the background job and returns `202 Accepted`.
  </action>
</task>

<task id="10.4">
  <title>Update Frontend Processing Screen</title>
  <action>
    Update `frontend/src/pages/ProcessingPage.jsx`:
    - Call the new `/start` endpoint when the page mounts.
    - Implement polling (`setInterval`) inside a `useEffect` to check `GET /api/sessions/:id` every 3 seconds. Store the `intervalId` and return a cleanup function (`clearInterval(intervalId)`) to cancel it on component unmount.
    - Handle transient network errors in the polling logic: detect HTTP 5xx and network/timeouts separately from session-level failures, log polling errors for debugging, implement simple retry/backoff for transient errors without stopping the interval loop. Ensure fetch errors are caught so they don't crash the effect.
    - Only `clearInterval` and stop polling when `session.status === 'completed'` (navigate to dashboard) or `session.status === 'failed'` (display a clear error message in the UI, offer a retry action, record failure details for debugging).
  </action>
</task>
