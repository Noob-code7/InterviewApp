import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, logout, refresh, me, updateProfile } from '../controllers/authController.js'
import { protect } from '../middleware/auth.js'

const router = Router()

const isDev = process.env.NODE_ENV !== 'production'

// Rate limiter for auth endpoints — generous in dev mode to prevent developer lockouts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts. Try again in 15 minutes.' },
})

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/logout', protect, logout)
router.post('/refresh', refresh)
router.get('/me', protect, me)
router.put('/profile', protect, updateProfile)

export default router
