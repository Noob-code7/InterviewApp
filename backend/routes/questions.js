import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import { generateQuestions } from '../controllers/questionController.js'

// We mount this router at /api/questions, but the path is nested:
// POST /api/questions/sessions/:sessionId/generate 
// Or better, we mount it directly in app.js as app.use('/api/sessions', ...) and handle it there?
// Wait, standard REST would be POST /api/sessions/:sessionId/questions
// Let's use this router on `/api/sessions` directly, or rename to match.
// I'll export a router that expects to be mounted at /api/sessions
const router = Router()

router.use(protect)

router.post('/:sessionId/questions', generateQuestions)

export default router
