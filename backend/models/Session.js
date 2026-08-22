import mongoose from 'mongoose'

const faceAnalysisSchema = new mongoose.Schema({
  confidenceScore:  { type: Number, default: null },
  nervousnessScore: { type: Number, default: null },
  attentionScore:   { type: Number, default: null },
  eyeContactScore:  { type: Number, default: null },
  notes:            { type: [String], default: [] },
  faceSubstitutionAlert: { type: Boolean, default: false },
}, { _id: false })

const voiceAnalysisSchema = new mongoose.Schema({
  transcript:       { type: String,  default: '' },
  confidenceScore:  { type: Number,  default: null },
  fluencyScore:     { type: Number,  default: null },
  fillerWordCount:  { type: Number,  default: null },
  speakingSpeed:    { type: Number,  default: null },
  clarityScore:     { type: Number,  default: null },
  emotionProbabilities: { type: mongoose.Schema.Types.Mixed, default: null },
  dominantEmotion:      { type: String, default: 'neutral' },
}, { _id: false })

const nlpAnalysisSchema = new mongoose.Schema({
  relevanceScore:    { type: Number, default: null },
  correctnessScore:  { type: Number, default: null },
  completenessScore: { type: Number, default: null },
  communicationScore: { type: Number, default: null },
  structureScore:    { type: Number, default: null },
  grammarScore:      { type: Number, default: null },
  overallScore:      { type: Number, default: null },
  feedback:          { type: String, default: '' },
  strengths:         { type: [String], default: [] },
  improvements:      { type: [String], default: [] },
  source:            { type: String, default: 'local' },

  misconceptionsDetected: { type: [String], default: [] },

  // Answer-aware routing provenance
  evaluationEngine:  { type: String, default: '' },
  answerType:        { type: String, default: '' },
}, { _id: false })

const followUpSchema = new mongoose.Schema({
  questionText:  { type: String, required: true },
  transcript:    { type: String, default: '' },
  turn:          { type: Number, default: 1 },
  startedAt:     { type: Date },
  completedAt:   { type: Date },
  videoUrl:      { type: String, default: '' },
  audioUrl:      { type: String, default: '' },
  faceAnalysis:  { type: faceAnalysisSchema,  default: () => ({}) },
  voiceAnalysis: { type: voiceAnalysisSchema, default: () => ({}) },
  nlpAnalysis:   { type: nlpAnalysisSchema,   default: () => ({}) },
}, { _id: false })

// ── Per-answer sub-schema ───────────────────────────────────────────────────────
const answerSchema = new mongoose.Schema({
  questionId:     { type: String, required: true },
  questionText:   { type: String, required: true },
  track:          { type: String, default: 'subject' },
  projectContext: { type: mongoose.Schema.Types.Mixed, default: null },
  // Answer-aware scoring metadata (persisted so analysis does not depend on DB lookups)
  answerType: {
    type: String,
    enum: ['warmup', 'binary', 'single_answer', 'short_answer', 'multiple_choice_style', 'explanatory'],
    default: 'explanatory',
  },
  isWarmup:          { type: Boolean, default: false },
  excludeFromScoring:{ type: Boolean, default: false },
  canonicalAnswer:   { type: String, default: '' },
  acceptedAnswers:   { type: [String], default: [] },
  expectedKeywords:  { type: [String], default: [] },
  expectedConcepts:  { type: [String], default: [] },
  referenceAnswer:   { type: String, default: '' },
  startedAt:      { type: Date },
  completedAt:    { type: Date },
  videoUrl:       { type: String, default: '' },
  audioUrl:       { type: String, default: '' },
  faceAnalysis:   { type: faceAnalysisSchema,  default: () => ({}) },
  voiceAnalysis:  { type: voiceAnalysisSchema, default: () => ({}) },
  nlpAnalysis:    { type: nlpAnalysisSchema,   default: () => ({}) },
  followUps:      { type: [followUpSchema],    default: [] },
}, { _id: false })

// ── Main Session schema ─────────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Student candidate identification
    candidateName: { type: String, default: '' },
    department:    { type: String, default: '' },
    rollNo:        { type: String, default: '' },
    graduationYear:{ type: String, default: '' },
    role:           { type: String, required: [true, 'Role is required'], trim: true },
    interviewType:  {
      type: String,
      enum: ['hr', 'technical', 'mixed', 'resume', 'company'],
      required: true,
    },
    questionCount:  { type: Number, min: 1, max: 20, default: 5 },
    // Technical mode: candidate-selected subjects of interest (canonical tags)
    subjectsOfInterest: { type: [String], default: [] },
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
    // Writing test & Drive settings
    includeWritingTest: { type: Boolean, default: true },
    driveCode:          { type: String, default: '' },
    writingTask:        { type: String, default: '' },
    writingSubmission:  { type: String, default: '' },
    writingAnalysis:    { type: mongoose.Schema.Types.Mixed, default: null },
    // Resume Based Mode
    resumeUrl:          { type: String, default: '' },
    resumeText:         { type: String, default: '' },
    // Report
    reportUrl:   { type: String, default: '' },
    reportData:  { type: mongoose.Schema.Types.Mixed, default: null },
    // Face verification
    referenceImageUrl: { type: String, default: '' },
    faceSubstitutionAlert: { type: Boolean, default: false },
    // Media privacy
    mediaDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
)

// Compound indexes matching the dominant query patterns (user-scoped listings,
// status-filtered dashboards, and recent-session sorting). _id + userId field
// index already exist; these cover the composite filters.
sessionSchema.index({ userId: 1, status: 1 })
sessionSchema.index({ userId: 1, createdAt: -1 })

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
