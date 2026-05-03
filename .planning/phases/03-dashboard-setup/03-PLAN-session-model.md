---
id: 03-PLAN-session-model
wave: 1
depends_on: []
files_modified:
  - backend/models/Session.js
  - backend/models/Question.js
  - backend/routes/sessions.js
  - backend/controllers/sessionController.js
  - backend/app.js
autonomous: true
requirements:
  - REQ-interview-flow
---

# Plan: Session & Question Models + Session API

## Goal
Create the Mongoose schemas for `Session` (tracks a full interview attempt) and `Question` (stores
generated questions for a session). Build the session REST endpoints used by the Dashboard
(list recent sessions, stats) and the Setup page (create new session). Wire into `app.js`.

## Architecture Note — AI Model Integration Points
> **Two custom ML models will be integrated in a future update:**
> - 🎥 **Video model** → `ai-services/face-service` — receives video frames and returns
>   confidence, nervousness, attention, and eye-contact scores.
> - 🎙️ **Audio model** → `ai-services/voice-service` — receives audio chunks and returns
>   transcript, fluency, pace, filler-word count, and clarity scores.
>
> The Session schema below includes `faceAnalysis` and `voiceAnalysis` sub-documents
> that hold the **placeholder output shape** these models will eventually fill.
> When the models are ready they are dropped into the respective FastAPI services and
> the existing schema requires **no changes** — only the stub implementation swaps out.

## Tasks

<task id="5.1">
  <title>Create Session Mongoose model</title>
  <read_first>
    - backend/models/User.js (pattern to follow)
    - backend/.env.example
  </read_first>
  <action>
    Create `backend/models/Session.js`:
    ```js
    import mongoose from 'mongoose'

    // ── Sub-schemas for AI model outputs ────────────────────────────────────────
    // These shapes are reserved for the custom ML models the user will provide.
    // Face-model output → faceAnalysis
    // Audio-model output → voiceAnalysis

    const faceAnalysisSchema = new mongoose.Schema({
      confidenceScore:  { type: Number, default: null },
      nervousnessScore: { type: Number, default: null },
      attentionScore:   { type: Number, default: null },
      eyeContactScore:  { type: Number, default: null },
      notes:            { type: [String], default: [] },
      // ⬇ RESERVED: additional fields populated by the video ML model
    }, { _id: false })

    const voiceAnalysisSchema = new mongoose.Schema({
      transcript:      { type: String, default: '' },
      confidenceScore: { type: Number, default: null },
      fluencyScore:    { type: Number, default: null },
      nervousnessScore:{ type: Number, default: null },
      fillerWordCount: { type: Number, default: null },
      speakingSpeed:   { type: Number, default: null }, // words per minute
      clarityScore:    { type: Number, default: null },
      // ⬇ RESERVED: additional fields populated by the audio ML model
    }, { _id: false })

    const nlpAnalysisSchema = new mongoose.Schema({
      relevanceScore:    { type: Number, default: null },
      structureScore:    { type: Number, default: null },
      grammarScore:      { type: Number, default: null },
      completenessScore: { type: Number, default: null },
      feedback:          { type: String, default: '' },
    }, { _id: false })

    // ── Per-answer sub-schema ────────────────────────────────────────────────────
    const answerSchema = new mongoose.Schema({
      questionId:   { type: String, required: true },
      questionText: { type: String, required: true },
      startedAt:    { type: Date },
      completedAt:  { type: Date },
      // Recordings stored in Cloudinary (populated in Phase 4)
      videoUrl:     { type: String, default: '' },
      audioUrl:     { type: String, default: '' },
      // AI analysis results (populated by microservices in Phase 5)
      faceAnalysis:  { type: faceAnalysisSchema,  default: () => ({}) },
      voiceAnalysis: { type: voiceAnalysisSchema, default: () => ({}) },
      nlpAnalysis:   { type: nlpAnalysisSchema,   default: () => ({}) },
    }, { _id: false })

    // ── Main Session schema ──────────────────────────────────────────────────────
    const sessionSchema = new mongoose.Schema(
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
          index: true,
        },
        role: {
          type: String,
          required: [true, 'Role is required'],
          trim: true,
        },
        interviewType: {
          type: String,
          enum: ['hr', 'technical', 'mixed', 'resume', 'company'],
          required: true,
        },
        questionCount: {
          type: Number,
          min: 1,
          max: 20,
          default: 5,
        },
        status: {
          type: String,
          enum: ['setup', 'in-progress', 'processing', 'completed', 'failed'],
          default: 'setup',
        },
        startedAt:   { type: Date },
        completedAt: { type: Date },

        // Questions + answers
        answers: { type: [answerSchema], default: [] },

        // Overall scores (computed from aggregating answer analyses)
        overallScore:     { type: Number, default: null },
        confidenceScore:  { type: Number, default: null },
        writingScore:     { type: Number, default: null },
        readinessLevel:   {
          type: String,
          enum: ['low', 'medium', 'high', 'market-ready', null],
          default: null,
        },

        // Writing test (Phase 6)
        writingTask:       { type: String, default: '' },
        writingSubmission: { type: String, default: '' },
        writingAnalysis:   { type: mongoose.Schema.Types.Mixed, default: null },

        // Report
        reportUrl: { type: String, default: '' },
        reportData: { type: mongoose.Schema.Types.Mixed, default: null },
      },
      {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
      }
    )

    // Virtual: duration in seconds
    sessionSchema.virtual('durationSeconds').get(function () {
      if (!this.startedAt || !this.completedAt) return null
      return Math.round((this.completedAt - this.startedAt) / 1000)
    })

    // Virtual: duration label "45 min"
    sessionSchema.virtual('durationLabel').get(function () {
      const secs = this.durationSeconds
      if (!secs) return null
      const mins = Math.round(secs / 60)
      return `${mins} min`
    })

    const Session = mongoose.model('Session', sessionSchema)
    export default Session
    ```
  </action>
  <acceptance_criteria>
    - backend/models/Session.js exists
    - backend/models/Session.js contains `faceAnalysisSchema` with `confidenceScore`
    - backend/models/Session.js contains `voiceAnalysisSchema` with `transcript`
    - backend/models/Session.js contains `RESERVED` comments for ML model slots
    - backend/models/Session.js contains `answerSchema` with `videoUrl` and `audioUrl`
    - backend/models/Session.js contains `status` enum with `in-progress`, `processing`, `completed`
    - backend/models/Session.js contains `durationSeconds` virtual
    - backend/models/Session.js contains `export default Session`
  </acceptance_criteria>
</task>

<task id="5.2">
  <title>Create session controller — create, list, get-by-id, stats</title>
  <read_first>
    - backend/models/Session.js
    - backend/utils/response.js
    - backend/middleware/auth.js
  </read_first>
  <action>
    Create `backend/controllers/sessionController.js`:
    ```js
    import Session from '../models/Session.js'
    import { sendSuccess, sendError } from '../utils/response.js'

    // ── POST /api/sessions — create a new session ────────────────────────────────
    export const createSession = async (req, res) => {
      try {
        const { role, interviewType, questionCount } = req.body

        if (!role || !interviewType) {
          return sendError(res, 'role and interviewType are required', 400)
        }

        const session = await Session.create({
          userId: req.user._id,
          role,
          interviewType,
          questionCount: questionCount || 5,
          status: 'setup',
        })

        return sendSuccess(res, { session }, 201)
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── GET /api/sessions — list user's sessions (paginated) ─────────────────────
    export const listSessions = async (req, res) => {
      try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1)
        const limit = Math.min(20, parseInt(req.query.limit) || 10)
        const skip  = (page - 1) * limit

        const [sessions, total] = await Promise.all([
          Session.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-answers -reportData -writingAnalysis'),
          Session.countDocuments({ userId: req.user._id }),
        ])

        return sendSuccess(res, {
          sessions,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── GET /api/sessions/:id — get a single session ─────────────────────────────
    export const getSession = async (req, res) => {
      try {
        const session = await Session.findOne({
          _id: req.params.id,
          userId: req.user._id,
        })
        if (!session) return sendError(res, 'Session not found', 404)
        return sendSuccess(res, { session })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── GET /api/sessions/stats — user's aggregate stats for Dashboard ───────────
    export const getStats = async (req, res) => {
      try {
        const userId = req.user._id

        const [totalCompleted, recent, scoreAgg] = await Promise.all([
          Session.countDocuments({ userId, status: 'completed' }),

          Session.find({ userId, status: 'completed' })
            .sort({ completedAt: -1 })
            .limit(3)
            .select('role interviewType overallScore confidenceScore completedAt durationLabel'),

          Session.aggregate([
            { $match: { userId, status: 'completed' } },
            {
              $group: {
                _id: null,
                avgConfidence: { $avg: '$confidenceScore' },
                avgWriting:    { $avg: '$writingScore' },
                avgOverall:    { $avg: '$overallScore' },
              },
            },
          ]),
        ])

        const scores = scoreAgg[0] || {}

        return sendSuccess(res, {
          stats: {
            interviewsCompleted: totalCompleted,
            avgConfidenceScore:  scores.avgConfidence ? Math.round(scores.avgConfidence) : null,
            avgWritingScore:     scores.avgWriting    ? Math.round(scores.avgWriting)    : null,
            avgOverallScore:     scores.avgOverall    ? Math.round(scores.avgOverall)    : null,
          },
          recentSessions: recent,
        })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── PATCH /api/sessions/:id/status — update session status ───────────────────
    export const updateStatus = async (req, res) => {
      try {
        const { status } = req.body
        const allowed = ['setup', 'in-progress', 'processing', 'completed', 'failed']
        if (!allowed.includes(status)) {
          return sendError(res, `status must be one of: ${allowed.join(', ')}`, 400)
        }

        const update = { status }
        if (status === 'in-progress') update.startedAt   = new Date()
        if (status === 'completed')   update.completedAt = new Date()

        const session = await Session.findOneAndUpdate(
          { _id: req.params.id, userId: req.user._id },
          { $set: update },
          { new: true }
        )
        if (!session) return sendError(res, 'Session not found', 404)

        return sendSuccess(res, { session })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }
    ```
  </action>
  <acceptance_criteria>
    - backend/controllers/sessionController.js exists
    - backend/controllers/sessionController.js contains `export const createSession`
    - backend/controllers/sessionController.js contains `export const listSessions`
    - backend/controllers/sessionController.js contains `export const getSession`
    - backend/controllers/sessionController.js contains `export const getStats`
    - backend/controllers/sessionController.js contains `export const updateStatus`
    - backend/controllers/sessionController.js contains `Session.aggregate(` for stats
  </acceptance_criteria>
</task>

<task id="5.3">
  <title>Create sessions router and wire into app.js</title>
  <read_first>
    - backend/routes/auth.js (pattern to follow)
    - backend/middleware/auth.js
    - backend/app.js
  </read_first>
  <action>
    Create `backend/routes/sessions.js`:
    ```js
    import { Router } from 'express'
    import { protect } from '../middleware/auth.js'
    import {
      createSession, listSessions, getSession,
      getStats, updateStatus,
    } from '../controllers/sessionController.js'

    const router = Router()

    // All session routes require authentication
    router.use(protect)

    router.get('/stats',   getStats)       // GET  /api/sessions/stats
    router.get('/',        listSessions)   // GET  /api/sessions
    router.post('/',       createSession)  // POST /api/sessions
    router.get('/:id',     getSession)     // GET  /api/sessions/:id
    router.patch('/:id/status', updateStatus) // PATCH /api/sessions/:id/status

    export default router
    ```

    Update `backend/app.js` — add import and mount route:
    Add to imports: `import sessionRoutes from './routes/sessions.js'`
    Replace stub comment `// Phase 3:  app.use('/api/sessions', sessionRoutes)`
    with: `app.use('/api/sessions', sessionRoutes)`
  </action>
  <acceptance_criteria>
    - backend/routes/sessions.js exists
    - backend/routes/sessions.js contains `router.get('/stats', getStats)`
    - backend/routes/sessions.js contains `router.use(protect)`
    - backend/app.js contains `import sessionRoutes from './routes/sessions.js'`
    - backend/app.js contains `app.use('/api/sessions', sessionRoutes)`
    - `node --input-type=module --eval "import('./app.js').then(() => console.log('APP_OK'))"` passes
  </acceptance_criteria>
</task>

## Verification
```bash
cd backend && node --input-type=module --eval "import('./app.js').then(() => console.log('APP_OK')).catch(e => { console.error(e.message); process.exit(1) })"
```

## must_haves
- [ ] Session schema has `faceAnalysis` + `voiceAnalysis` sub-docs with RESERVED ML model slots
- [ ] Session schema has `answerSchema` with `videoUrl`, `audioUrl`
- [ ] Session schema has `status` enum: setup → in-progress → processing → completed
- [ ] `getStats` aggregates avg confidence + writing + overall scores across completed sessions
- [ ] All session routes protected by `protect` middleware
- [ ] `app.js` mounts `/api/sessions`
