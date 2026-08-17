import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Session from '../models/Session.js'
import { storageService } from '../services/storageService.js'
import { sendSuccess, sendError } from '../utils/response.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')

const ALLOWED_MIME_TYPES = [
  'video/webm',
  'video/mp4',
  'audio/webm',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
]

// ── POST /api/storage/presigned-url ─────────────────────────────────────────
export const requestPresignedUrl = async (req, res) => {
  try {
    const { resourceType, interviewId, questionId, contentType } = req.body

    if (!resourceType || !contentType) {
      return sendError(res, 'resourceType and contentType are required', 400)
    }

    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return sendError(res, `Unsupported content-type: ${contentType}`, 400)
    }

    const userId = req.user._id
    let key = ''

    if (resourceType === 'video' || resourceType === 'audio') {
      if (!interviewId) {
        return sendError(res, 'interviewId is required for interview media', 400)
      }

      // Enforce session ownership check
      const session = await Session.findOne({ _id: interviewId, userId })
      if (!session) {
        return sendError(res, 'Forbidden: You do not own this interview session', 403)
      }

      const clipId = questionId || `clip-${Date.now()}`
      const ext = contentType.includes('webm') ? 'webm' : contentType.includes('mp4') ? 'mp4' : 'wav'
      key = `interviews/${interviewId}/${resourceType}/${clipId}.${ext}`
    } else if (resourceType === 'resume') {
      const resumeId = `resume-${Date.now()}`
      key = `resumes/${userId}/${resumeId}.pdf`
    } else {
      return sendError(res, `Invalid resourceType: ${resourceType}`, 400)
    }

    const presignedData = await storageService.getPresignedUploadUrl({
      key,
      contentType,
      expiresIn: 900,
    })

    return sendSuccess(res, presignedData, 200)
  } catch (err) {
    console.error('[StorageController] Presigned URL error:', err)
    return sendError(res, err.message, 500)
  }
}

// ── POST /api/storage/local-upload (Fallback mode) ─────────────────────────
export const handleLocalUpload = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, 'No file uploaded', 400)
    }

    const key = req.body.key || `media-${Date.now()}.webm`
    const filename = path.basename(key)
    const destPath = path.join(uploadsDir, filename)

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    fs.writeFileSync(destPath, req.file.buffer)
    const fileUrl = `/uploads/${filename}`

    return sendSuccess(res, { key, fileUrl }, 200)
  } catch (err) {
    console.error('[StorageController] Local upload error:', err)
    return sendError(res, err.message, 500)
  }
}
