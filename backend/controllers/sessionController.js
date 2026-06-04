import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Session from '../models/Session.js'
import { sendSuccess, sendError } from '../utils/response.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')

// ── POST /api/sessions ────────────────────────────────────────────────────────
export const createSession = async (req, res) => {
  try {
    const { role, interviewType, questionCount, referenceImage } = req.body
    if (!role || !interviewType) {
      return sendError(res, 'role and interviewType are required', 400)
    }

    const session = new Session({
      userId: req.user._id,
      role,
      interviewType,
      questionCount: questionCount || 5,
      status: 'setup',
    })

    // If a reference image is provided (base64 string), save it
    if (referenceImage) {
      const matches = referenceImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
        const imageBuffer = Buffer.from(matches[2], 'base64')
        const filename = `${session._id}-ref.${extension}`
        const filePath = path.join(uploadsDir, filename)
        
        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }
        
        fs.writeFileSync(filePath, imageBuffer)
        session.referenceImageUrl = `/uploads/${filename}`
      }
    }

    await session.save()
    return sendSuccess(res, { session }, 201)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── GET /api/sessions ─────────────────────────────────────────────────────────
export const listSessions = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(20, parseInt(req.query.limit) || 10)
    const skip  = (page - 1) * limit

    const [sessions, total] = await Promise.all([
      Session.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-answers -reportData -writingAnalysis'),
      Session.countDocuments({ userId: req.user._id }),
    ])

    return sendSuccess(res, {
      sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── GET /api/sessions/stats ───────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const userId = req.user._id

    const [totalCompleted, recent, scoreAgg] = await Promise.all([
      Session.countDocuments({ userId, status: 'completed' }),
      Session.find({ userId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(3)
        .select('role interviewType overallScore confidenceScore completedAt durationLabel'),
      Session.aggregate([
        { $match: { userId, status: 'completed' } },
        {
          $group: {
            _id: null,
            avgConfidence: { $avg: '$confidenceScore' },
            avgWriting:    { $avg: '$writingScore' },
            avgOverall:    { $avg: '$overallScore' },
          },
        },
      ]),
    ])

    const scores = scoreAgg[0] || {}
    return sendSuccess(res, {
      stats: {
        interviewsCompleted: totalCompleted,
        avgConfidenceScore:  scores.avgConfidence ? Math.round(scores.avgConfidence) : null,
        avgWritingScore:     scores.avgWriting    ? Math.round(scores.avgWriting)    : null,
        avgOverallScore:     scores.avgOverall    ? Math.round(scores.avgOverall)    : null,
      },
      recentSessions: recent,
    })
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
export const getSession = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id })
    if (!session) return sendError(res, 'Session not found', 404)
    return sendSuccess(res, { session })
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── PATCH /api/sessions/:id/status ───────────────────────────────────────────
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['setup', 'in-progress', 'processing', 'completed', 'failed']
    if (!allowed.includes(status)) {
      return sendError(res, `status must be one of: ${allowed.join(', ')}`, 400)
    }
    const update = { status }
    if (status === 'in-progress') update.startedAt   = new Date()
    if (status === 'completed')   update.completedAt = new Date()

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: update },
      { new: true }
    )
    if (!session) return sendError(res, 'Session not found', 404)
    return sendSuccess(res, { session })
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}
