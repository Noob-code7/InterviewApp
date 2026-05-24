import Session from '../models/Session.js'
import { sendSuccess, sendError } from '../utils/response.js'
import storage from '../services/storage.js'

// ── POST /api/sessions/:sessionId/answers/:questionId ───────────────────────
export const uploadAnswer = async (req, res) => {
  try {
    const { sessionId, questionId } = req.params

    if (!req.file || !req.file.buffer) {
      return sendError(res, 'No video file uploaded', 400)
    }

    // Validate mimetype
    const allowed = [
      'video/webm',
      'audio/webm',
      'video/mp4',
      'audio/mpeg',
      'audio/wav',
    ]
    if (req.file.mimetype && !allowed.includes(req.file.mimetype)) {
      return sendError(res, 'Unsupported media type', 415)
    }

    // Build an S3 key and upload the buffer
    const filename = req.file.originalname || `answer.webm`
    const key = storage.makeKeyForAnswer(sessionId, filename)
    let uploadRes
    try {
      uploadRes = await storage.uploadBuffer(req.file.buffer, key, req.file.mimetype || 'video/webm')
    } catch (err) {
      console.error('S3 upload failed:', err)
      return sendError(res, 'Failed to store uploaded file', 500)
    }

    const videoUrl = uploadRes.url
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
