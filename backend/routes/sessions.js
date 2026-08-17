import { Router } from 'express'
import multer from 'multer'
import { protect } from '../middleware/auth.js'
import {
  createSession, parseResume, listSessions, getSession,
  getStats, updateStatus, getUserHistory,
} from '../controllers/sessionController.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
})

const router = Router()

// All session routes require authentication
router.use(protect)

router.get('/history', getUserHistory) // GET /api/sessions/history
router.get('/stats',   getStats)       // GET  /api/sessions/stats
router.get('/',        listSessions)   // GET  /api/sessions
router.post('/parse-resume', upload.single('resume'), parseResume) // POST /api/sessions/parse-resume
router.post('/',       createSession)  // POST /api/sessions
router.get('/:id',     getSession)     // GET  /api/sessions/:id
router.patch('/:id/status', updateStatus) // PATCH /api/sessions/:id/status

export default router
