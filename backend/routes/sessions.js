import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { protect } from '../middleware/auth.js'
import {
  createSession, parseResume, listSessions, getSession, getSessionStatus,
  getStats, updateStatus, getUserHistory, generateProjectFollowUpHandler
} from '../controllers/sessionController.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
})

// Lightweight per-IP limiter for the status-polling endpoint so that polling
// does not consume the same budget as analysis/upload operations. Configurable
// via STATUS_RATE_LIMIT_MAX (falls back to the global rate limit).
const statusLimiter = rateLimit({
  windowMs: Number(process.env.STATUS_RATE_LIMIT_WINDOW_MS) ||
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000,
  max: (() => {
    const configured = Number(process.env.STATUS_RATE_LIMIT_MAX)
    if (configured > 0) return configured
    const global = Number(process.env.RATE_LIMIT_MAX)
    if (global > 0) return global
    return process.env.NODE_ENV === 'production' ? 300 : 2000
  })(),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
})

const router = Router()

// All session routes require authentication
router.use(protect)

router.get('/history', getUserHistory) // GET /api/sessions/history
router.get('/stats',   getStats)       // GET  /api/sessions/stats
router.get('/',        listSessions)   // GET  /api/sessions
router.post('/parse-resume', upload.single('resume'), parseResume) // POST /api/sessions/parse-resume
router.post('/',       createSession)  // POST /api/sessions
router.get('/:id/status', statusLimiter, getSessionStatus) // GET /api/sessions/:id/status (before /:id)
router.get('/:id',     getSession)     // GET  /api/sessions/:id
router.patch('/:id/status', updateStatus) // PATCH /api/sessions/:id/status
router.post('/:id/project-followup', generateProjectFollowUpHandler) // POST /api/sessions/:id/project-followup

export default router