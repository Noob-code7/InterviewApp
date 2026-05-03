---
id: 04-PLAN-interview-api
wave: 1
depends_on:
  - 03-PLAN-session-model
files_modified:
  - backend/controllers/questionController.js
  - backend/routes/questions.js
  - backend/controllers/answerController.js
  - backend/routes/answers.js
  - backend/app.js
autonomous: true
requirements:
  - REQ-interview-flow
---

# Plan: Interview Questions & Answers API

## Goal
Implement the endpoints necessary to generate questions and save recorded answers during the live interview.

## Tasks

<task id="8.1">
  <title>Create question generator controller</title>
  <action>
    Create `backend/controllers/questionController.js` and `backend/routes/questions.js`.
    - `generateQuestions` endpoint: Takes a `sessionId`, checks the `interviewType` and `role`, and generates a list of mock questions. Saves them to the session's `answers` array with empty video/audio URLs.
  </action>
</task>

<task id="8.2">
  <title>Create answers upload controller</title>
  <action>
    Create `backend/controllers/answerController.js` and `backend/routes/answers.js`.
    - Setup `multer` middleware to save WebM files to `backend/uploads/`.
    - `uploadAnswer` endpoint: Receives the video file and updates the specific answer in the `session.answers` array with the local `videoUrl` and `audioUrl`.
  </action>
</task>

<task id="8.3">
  <title>Wire routes into app.js</title>
  <action>
    Update `backend/app.js`:
    - Serve `/uploads` statically.
    - Mount `/api/sessions` for both the question and answer routers.
  </action>
</task>
