import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

const app = express()

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet())

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Global rate limiter — tighter limits on auth routes added in Phase 2
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
})
app.use(globalLimiter)

// ── Body / cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── HTTP logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'OK', timestamp: new Date().toISOString() } })
})

// ── API root ──────────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({ success: true, data: { message: 'AI Interview Platform API v1' } })
})

// ── Route stubs — filled in per phase ─────────────────────────────────────────
// Phase 2:  app.use('/api/auth', authRoutes)
// Phase 3:  app.use('/api/sessions', sessionRoutes)
// Phase 3:  app.use('/api/questions', questionRoutes)
// Phase 4:  app.use('/api/answers', answerRoutes)
// Phase 5:  app.use('/api/analysis', analysisRoutes)
// Phase 6:  app.use('/api/writing', writingRoutes)
// Phase 7:  app.use('/api/reports', reportRoutes)
// Phase 8:  app.use('/api/progress', progressRoutes)

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  })
})

export default app
