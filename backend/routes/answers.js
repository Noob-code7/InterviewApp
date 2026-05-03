import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { protect } from '../middleware/auth.js'
import { uploadAnswer } from '../controllers/answerController.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `answer-${uniqueSuffix}${path.extname(file.originalname || '.webm')}`)
  }
})

const upload = multer({ storage })

const router = Router()

router.use(protect)

router.post('/:sessionId/answers/:questionId', upload.single('video'), uploadAnswer)

export default router
