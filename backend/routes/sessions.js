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
