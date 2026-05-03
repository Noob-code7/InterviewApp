---
id: 04-PLAN-live-interface
wave: 2
depends_on:
  - 04-PLAN-interview-api
files_modified:
  - frontend/src/api/interview.js
  - frontend/src/pages/LiveInterviewPage.jsx
  - frontend/src/pages/ProcessingPage.jsx
  - frontend/src/App.jsx
autonomous: true
requirements:
  - REQ-interview-flow
---

# Plan: Live Interview Interface

## Goal
Build the core UI that interacts with the user's camera/microphone and records their responses to the generated questions.

## Tasks

<task id="9.1">
  <title>Create interview API client</title>
  <action>
    Create `frontend/src/api/interview.js`:
    - Add `generateQuestions(sessionId)` and `uploadAnswer(sessionId, questionId, videoBlob)` using FormData.
  </action>
</task>

<task id="9.2">
  <title>Build LiveInterviewPage</title>
  <action>
    Create `frontend/src/pages/LiveInterviewPage.jsx`:
    - **Initialization**: Checks if session has questions. If not, generates them.
    - **MediaRecorder Logic**: Captures the video/audio stream.
    - **UI layout**: Shows a mirrored video feed, current question, and a timer.
    - **AI Integration Slots**: Comments added (`// ── AI MODEL INTEGRATION SLOT`) for future WebSocket streaming to Python microservices.
  </action>
</task>

<task id="9.3">
  <title>Build ProcessingPage & Wire App.jsx</title>
  <action>
    Create `frontend/src/pages/ProcessingPage.jsx`:
    - Rotating AI loading screen.
    Wire both new pages into `frontend/src/App.jsx`.
  </action>
</task>
