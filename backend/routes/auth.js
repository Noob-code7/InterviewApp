import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, logout, refresh, me } from '../controllers/authController.js'
import { protect } from '../middleware/auth.js'

const router = Router()

// Strict rate limiter for auth endpoints — 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts. Try again in 15 minutes.' },
})

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/logout', protect, logout)
router.post('/refresh', refresh)
router.get('/me', protect, me)

export default router
