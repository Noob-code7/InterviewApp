import Session from '../models/Session.js'
import { sendSuccess, sendError } from '../utils/response.js'

// ── POST /api/sessions/:sessionId/answers/:questionId ───────────────────────
export const uploadAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params

    if (!req.file) {
      return sendError(res, 'No video file uploaded', 400)
    }

    // In local dev, multer saves the file to /uploads. 
    // The path will be accessible via /uploads/filename
    const videoUrl = `/uploads/${req.file.filename}`
    // We assume the same file contains both audio and video (webm)
    const audioUrl = videoUrl 

    const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
    if (!session) return sendError(res, 'Session not found', 404)

    const answerIndex = session.answers.findIndex(a => a.questionId === questionId)
    if (answerIndex === -1) {
      return sendError(res, 'Question not found in session', 404)
    }

    session.answers[answerIndex].videoUrl = videoUrl
    session.answers[answerIndex].audioUrl = audioUrl
    session.answers[answerIndex].completedAt = new Date()
    
    // If we wanted to trigger AI processing here, we could push a job to a queue.
    // For Phase 4, we just save the URLs.

    await session.save()

    return sendSuccess(res, { answer: session.answers[answerIndex] })
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}
