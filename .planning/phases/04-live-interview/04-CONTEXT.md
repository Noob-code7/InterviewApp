# Phase 04 — Context & Decisions

Date: 2026-05-23

Summary:

- Evidence found in codebase that implements the Phase 4 goals: frontend `LiveInterviewPage.jsx`, `ProcessingPage.jsx`, backend `questionController.js`, `answerController.js`, `answers` and `questions` routes, and uploads/static serving in `backend/app.js`.

Decisions / Locked-in:

- Questions generation: implemented via `POST /api/sessions/:sessionId/questions` (`generateQuestions`).
- Answer upload: implemented via `POST /api/sessions/:sessionId/answers/:questionId` with `multer` saving to `backend/uploads` and `answerController.uploadAnswer` updating `session.answers`.
- Client-side recording and upload: `frontend/src/pages/LiveInterviewPage.jsx` implements `MediaRecorder`, chunking, upload, and navigation to processing screen.

Gray areas / Follow-ups (not blocking downstream planners):

- E2E tests and automated validation of upload/streaming are not present.
- Media storage is local uploads; migrating to cloud (Cloudinary/S3) is not implemented.
- Real-time streaming to Python microservices is stubbed in comments — Phase 5 covers analysis.

Actionable next steps for planners/researchers:

- Add e2e tests for recording/upload flow.
- Design migration plan for cloud storage and valid public URLs.
- Consider performance tests for MediaRecorder behavior across browsers.
