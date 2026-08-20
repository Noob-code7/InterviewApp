import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import {
  recordQuestionHistory,
  getUserQuestionHistory,
  getQuestionHistoryStats,
} from '../controllers/questionHistoryController.js'

const router = Router()

// All question history routes require authentication
router.use(protect)

// POST /api/question-history/:sessionId - Record question history when questions are delivered
router.post('/:sessionId', recordQuestionHistory)

// GET /api/question-history?tags=os,dbms - Get user's question history for specific tags
router.get('/', getUserQuestionHistory)

// GET /api/question-history/stats - Get question history statistics
router.get('/stats', getQuestionHistoryStats)

export default router