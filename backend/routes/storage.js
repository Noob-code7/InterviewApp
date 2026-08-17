import { Router } from 'express'
import multer from 'multer'
import { protect } from '../middleware/auth.js'
import { requestPresignedUrl, handleLocalUpload } from '../controllers/storageController.js'

const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }) // 100MB max limit
const router = Router()

// All storage routes require authentication
router.use(protect)

router.post('/presigned-url', requestPresignedUrl)
router.post('/local-upload', upload.single('file'), handleLocalUpload)

export default router
