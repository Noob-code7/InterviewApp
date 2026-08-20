import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Session from '../models/Session.js'
import llmService from '../services/llmService.js'
import { sendSuccess, sendError } from '../utils/response.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')

// ── POST /api/sessions ──────────────────────────────────────────────────────────
export const createSession = async (req, res) => {
  try {
    const {
      role,
      interviewType,
      questionCount,
      referenceImage,
      candidateName,
      department,
      rollNo,
      graduationYear,
      resumeText,
      resumeUrl,
      includeWritingTest,
    } = req.body
    if (!role || !interviewType) {
      return sendError(res, 'role and interviewType are required', 400)
    }

    const session = new Session({
      userId: req.user._id,
      candidateName: candidateName || req.user.name || 'Candidate Student',
      department: department || req.user.department || '',
      rollNo: rollNo || req.user.rollNo || '',
      graduationYear: graduationYear || req.user.graduationYear || '',
      role,
      interviewType,
      questionCount: questionCount || 5,
      resumeText: resumeText || '',
      resumeUrl: resumeUrl || '',
      includeWritingTest: typeof includeWritingTest === 'boolean' ? includeWritingTest : true,
      status: 'setup',
    })

    // If a reference image is provided (base64 string), save it safely
    if (referenceImage) {
      try {
        const matches = referenceImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
          const imageBuffer = Buffer.from(matches[2], 'base64')
          const filename = `${session._id}-ref.${extension}`
          const filePath = path.join(uploadsDir, filename)
          
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true })
          }
          
          fs.writeFileSync(filePath, imageBuffer)
          session.referenceImageUrl = `/uploads/${filename}`
        }
      } catch (refErr) {
        console.error('[SessionController] Failed to save reference image:', refErr.message)
      }
    }

    await session.save()
    return sendSuccess(res, { session }, 201)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── POST /api/sessions/parse-resume ────────────────────────────────────────────
export const parseResume = async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, "Resume file is required", 400);
    }

    const axios = (await import("axios")).default;
    const FormData = (await import("form-data")).default;
    const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8003";

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype || "application/octet-stream",
    });
    formData.append("role", req.body.role || "Software Engineer");
    formData.append("count", req.body.count || 5);

    const nlpRes = await axios.post(
      `${NLP_SERVICE_URL}/extract-and-generate-resume-questions`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );

    return sendSuccess(res, nlpRes.data?.data || {}, 200);
  } catch (err) {
    console.error("[SessionController] Error parsing resume file:", err.message);
    return sendError(res, "Failed to parse resume document: " + err.message, 500);
  }
};

// ── GET /api/sessions ───────────────────────────────────────────────────────────
export const listSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-answers.videoUrl -answers.audioUrl')
    return sendSuccess(res, { sessions }, 200)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── GET /api/sessions/history ──────────────────────────────────────────────────
export const getUserHistory = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
    return sendSuccess(res, { sessions }, 200)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── GET /api/sessions/:id ──────────────────────────────────────────────────────
export const getSession = async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
    if (!session) return sendError(res, 'Session not found', 404)
    return sendSuccess(res, { session }, 200)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── GET /api/sessions/:id/status ───────────────────────────────────────────────
// Lightweight status polling endpoint: returns only analysis lifecycle fields so
// polling clients do not pull the full session payload on every request.

export const getSessionStatus = async (req, res) => {

  try {

    const session = await Session.findOne({

      _id: req.params.id,

      userId: req.user._id,

    }).select('status jobStatus overallScore')

    if (!session) return sendError(res, 'Session not found', 404)

    return sendSuccess(res, {

      session: {

        _id: session._id,

        status: session.status,

        jobStatus: session.jobStatus,

        overallScore: session.overallScore,

      },

    }, 200)

  } catch (err) {

    return sendError(res, err.message, 500)

  }

}



// ── PATCH /api/sessions/:id/status ─────────────────────────────────────────────
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['setup', 'in-progress', 'processing', 'completed', 'failed']
    if (!allowed.includes(status)) {
      return sendError(res, `Invalid status. Allowed: ${allowed.join(', ')}`, 400)
    }

    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
    if (!session) return sendError(res, 'Session not found', 404)

    session.status = status
    if (status === 'in-progress' && !session.startedAt) {
      session.startedAt = new Date()
    }
    if (status === 'completed' && !session.completedAt) {
      session.completedAt = new Date()
    }

    await session.save()
    return sendSuccess(res, { session }, 200)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

// ── POST /api/sessions/:id/project-followup (Phase 4 Interactive Loop) ─────────
export const generateProjectFollowUpHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionId, questionText, answerText, projectContext, previousFollowUps } = req.body;

    const session = await Session.findOne({ _id: id, userId: req.user._id });
    if (!session) return sendError(res, "Session not found", 404);

    // Server-authoritative follow-up cap: count nested followUps already stored
    const parentAnswer = session.answers.find(
      (a) => String(a.questionId) === String(questionId) || String(a._id) === String(questionId)
    );
    const existingFollowUps = parentAnswer?.followUps?.length || 0;
    if (existingFollowUps >= 2) {
      return sendSuccess(res, { hasFollowUp: false, reason: "max_followups_reached" }, 200);
    }

    const followUp = await llmService.generateProjectFollowUp(
      projectContext,
      questionText,
      answerText,
      previousFollowUps || [],
      existingFollowUps + 1
    );

    if (followUp && followUp.questionText) {
      return sendSuccess(res, { hasFollowUp: true, followUp }, 200);
    }

    return sendSuccess(res, { hasFollowUp: false }, 200);
  } catch (err) {
    console.error("[SessionController] Error in generateProjectFollowUpHandler:", err.message);
    return sendSuccess(res, { hasFollowUp: false }, 200);
  }
};

// ── GET /api/sessions/stats ────────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-answers.videoUrl -answers.audioUrl')

    const totalSessions = sessions.length
    const completedSessions = sessions.filter((s) => s.status === 'completed')
    const completedCount = completedSessions.length

    let totalScoreSum = 0
    completedSessions.forEach((s) => {
      totalScoreSum += s.overallScore || 0
    })

    const averageScore = completedCount > 0 ? Math.round(totalScoreSum / completedCount) : 0

    let readinessLevel = 'Not Evaluated'
    if (averageScore >= 85) readinessLevel = 'Market Ready 🚀'
    else if (averageScore >= 75) readinessLevel = 'High Readiness 🟢'
    else if (averageScore >= 60) readinessLevel = 'Medium Readiness 🟡'
    else if (completedCount > 0) readinessLevel = 'Building Foundation 🔵'

    return sendSuccess(res, {
      sessions,
      stats: {
        totalSessions,
        completedCount,
        averageScore,
        readinessLevel,
      },
    })
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}

export default {
  createSession,
  parseResume,
  listSessions,
  getUserHistory,
  getSession,
    getSessionStatus,
  updateStatus,
  generateProjectFollowUpHandler,
  getStats,
}
