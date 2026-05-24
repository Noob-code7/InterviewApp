import mongoose from 'mongoose'

// ── Sub-schemas ─ reserved slots for the two custom ML models ────────────────
//
//  🎥  VIDEO MODEL  → ai-services/face-service
//      Output shape:  faceAnalysisSchema
//      Status:        STUB — drop model into face-service/main.py when ready
//
//  🎙️  AUDIO MODEL  → ai-services/voice-service
//      Output shape:  voiceAnalysisSchema
//      Status:        STUB — drop model into voice-service/main.py when ready
//
// The Session schema requires NO changes when the models are integrated.
// ─────────────────────────────────────────────────────────────────────────────

const faceAnalysisSchema = new mongoose.Schema({
  confidenceScore:  { type: Number, default: null },
  nervousnessScore: { type: Number, default: null },
  attentionScore:   { type: Number, default: null },
  eyeContactScore:  { type: Number, default: null },
  notes:            { type: [String], default: [] },
  // ⬇ RESERVED — populated by video ML model (face-service)
}, { _id: false })

const voiceAnalysisSchema = new mongoose.Schema({
  transcript:       { type: String,  default: '' },
  confidenceScore:  { type: Number,  default: null },
  fluencyScore:     { type: Number,  default: null },
  fillerWordCount:  { type: Number,  default: null },
  speakingSpeed:    { type: Number,  default: null }, // words-per-minute
  clarityScore:     { type: Number,  default: null },
  // ⬇ RESERVED — populated by audio ML model (voice-service)
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
  questionId:    { type: String, required: true },
  questionText:  { type: String, required: true },
  startedAt:     { type: Date },
  completedAt:   { type: Date },
  videoUrl:      { type: String, default: '' }, // Cloudinary — Phase 4
  audioUrl:      { type: String, default: '' }, // Cloudinary — Phase 4
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
    role:           { type: String, required: [true, 'Role is required'], trim: true },
    interviewType:  {
      type: String,
      enum: ['hr', 'technical', 'mixed', 'resume', 'company'],
      required: true,
    },
    questionCount:  { type: Number, min: 1, max: 20, default: 5 },
    status: {
      type: String,
      enum: ['setup', 'in-progress', 'processing', 'completed', 'failed'],
      default: 'setup',
    },
    jobStatus: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed', null],
      default: null,
    },
    startedAt:    { type: Date },
    completedAt:  { type: Date },
    answers:      { type: [answerSchema], default: [] },
    // Aggregated scores (computed after AI analysis)
    overallScore:    { type: Number, default: null },
    confidenceScore: { type: Number, default: null },
    writingScore:    { type: Number, default: null },
    readinessLevel:  {
      type: String,
      enum: ['low', 'medium', 'high', 'market-ready', null],
      default: null,
    },
    // Writing test — Phase 6
    writingTask:        { type: String, default: '' },
    writingSubmission:  { type: String, default: '' },
    writingAnalysis:    { type: mongoose.Schema.Types.Mixed, default: null },
    // Report — Phase 7
    reportUrl:   { type: String, default: '' },
    reportData:  { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
)

sessionSchema.virtual('durationSeconds').get(function () {
  if (!this.startedAt || !this.completedAt) return null
  return Math.round((this.completedAt - this.startedAt) / 1000)
})

sessionSchema.virtual('durationLabel').get(function () {
  const secs = this.durationSeconds
  if (!secs) return null
  return `${Math.round(secs / 60)} min`
})

const Session = mongoose.model('Session', sessionSchema)
export default Session
