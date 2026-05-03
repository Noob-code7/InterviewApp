---
id: 02-PLAN-auth-backend
wave: 1
depends_on: []
files_modified:
  - backend/models/User.js
  - backend/middleware/auth.js
  - backend/controllers/authController.js
  - backend/routes/auth.js
  - backend/utils/jwt.js
  - backend/app.js
autonomous: true
requirements:
  - REQ-auth-jwt
---

# Plan: Auth Backend — User Model, JWT, API Routes

## Goal
Implement the complete authentication backend: User Mongoose schema, bcrypt password hashing, JWT access + refresh token generation/validation, and all five auth REST endpoints (`/register`, `/login`, `/logout`, `/refresh`, `/me`). Wire the router into `app.js`. All responses use the `{ success, data, error }` structure from `utils/response.js`.

## Tasks

<task id="2.1">
  <title>Create User Mongoose model</title>
  <read_first>
    - backend/package.json (confirm bcryptjs and mongoose are present)
    - backend/models/ (confirm directory exists)
  </read_first>
  <action>
    Create `backend/models/User.js`:
    ```js
    import mongoose from 'mongoose'
    import bcrypt from 'bcryptjs'

    const userSchema = new mongoose.Schema(
      {
        name: {
          type: String,
          required: [true, 'Name is required'],
          trim: true,
          maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
          type: String,
          required: [true, 'Email is required'],
          unique: true,
          lowercase: true,
          trim: true,
          match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        passwordHash: {
          type: String,
          required: true,
          minlength: 6,
          select: false, // never returned in queries by default
        },
        role: {
          type: String,
          enum: ['user', 'admin'],
          default: 'user',
        },
        college: { type: String, trim: true, default: '' },
        targetRole: { type: String, trim: true, default: '' },
        refreshTokens: {
          type: [String],
          default: [],
          select: false, // security: not returned in queries by default
        },
      },
      { timestamps: true }
    )

    // Hash password before save
    userSchema.pre('save', async function (next) {
      if (!this.isModified('passwordHash')) return next()
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12)
      next()
    })

    // Instance method: compare plaintext password against stored hash
    userSchema.methods.comparePassword = async function (plaintext) {
      return bcrypt.compare(plaintext, this.passwordHash)
    }

    // Instance method: return safe user object (no sensitive fields)
    userSchema.methods.toSafeObject = function () {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        college: this.college,
        targetRole: this.targetRole,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      }
    }

    const User = mongoose.model('User', userSchema)
    export default User
    ```
  </action>
  <acceptance_criteria>
    - backend/models/User.js exists
    - backend/models/User.js contains `bcrypt.hash(this.passwordHash, 12)`
    - backend/models/User.js contains `select: false` on passwordHash field
    - backend/models/User.js contains `refreshTokens` field
    - backend/models/User.js contains `export default User`
  </acceptance_criteria>
</task>

<task id="2.2">
  <title>Create JWT utility — sign and verify tokens</title>
  <read_first>
    - backend/package.json (confirm jsonwebtoken is present)
    - backend/.env.example (confirm JWT env var names)
  </read_first>
  <action>
    Create `backend/utils/jwt.js`:
    ```js
    import jwt from 'jsonwebtoken'

    /**
     * Sign a short-lived access token (default 15m).
     */
    export const signAccessToken = (userId) => {
      return jwt.sign(
        { sub: userId, type: 'access' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
      )
    }

    /**
     * Sign a long-lived refresh token (default 7d).
     */
    export const signRefreshToken = (userId) => {
      return jwt.sign(
        { sub: userId, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
      )
    }

    /**
     * Verify an access token. Throws if invalid or expired.
     */
    export const verifyAccessToken = (token) => {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    }

    /**
     * Verify a refresh token. Throws if invalid or expired.
     */
    export const verifyRefreshToken = (token) => {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    }

    /**
     * Extract Bearer token from Authorization header.
     * Returns null if header is missing or malformed.
     */
    export const extractBearerToken = (req) => {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) return null
      return authHeader.split(' ')[1]
    }
    ```
  </action>
  <acceptance_criteria>
    - backend/utils/jwt.js exists
    - backend/utils/jwt.js contains `signAccessToken`
    - backend/utils/jwt.js contains `signRefreshToken`
    - backend/utils/jwt.js contains `verifyAccessToken`
    - backend/utils/jwt.js contains `verifyRefreshToken`
    - backend/utils/jwt.js contains `extractBearerToken`
  </acceptance_criteria>
</task>

<task id="2.3">
  <title>Create auth middleware — protect routes</title>
  <read_first>
    - backend/utils/jwt.js
    - backend/models/User.js
    - backend/utils/response.js
  </read_first>
  <action>
    Create `backend/middleware/auth.js`:
    ```js
    import { verifyAccessToken, extractBearerToken } from '../utils/jwt.js'
    import User from '../models/User.js'
    import { sendError } from '../utils/response.js'

    /**
     * Protect middleware — verifies JWT access token.
     * Attaches req.user (safe user object) on success.
     */
    export const protect = async (req, res, next) => {
      try {
        const token = extractBearerToken(req)
        if (!token) {
          return sendError(res, 'Access token required', 401)
        }

        const decoded = verifyAccessToken(token)
        const user = await User.findById(decoded.sub)
        if (!user) {
          return sendError(res, 'User not found', 401)
        }

        req.user = user.toSafeObject()
        next()
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return sendError(res, 'Access token expired', 401)
        }
        return sendError(res, 'Invalid access token', 401)
      }
    }

    /**
     * Restrict middleware — only allows specified roles.
     * Must be used AFTER protect.
     * Usage: router.get('/admin', protect, restrict('admin'), handler)
     */
    export const restrict = (...roles) => {
      return (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
          return sendError(res, 'You do not have permission to perform this action', 403)
        }
        next()
      }
    }
    ```
  </action>
  <acceptance_criteria>
    - backend/middleware/auth.js exists
    - backend/middleware/auth.js contains `export const protect`
    - backend/middleware/auth.js contains `export const restrict`
    - backend/middleware/auth.js contains `verifyAccessToken(`
    - backend/middleware/auth.js contains `req.user = user.toSafeObject()`
  </acceptance_criteria>
</task>

<task id="2.4">
  <title>Create auth controller — all 5 endpoint handlers</title>
  <read_first>
    - backend/models/User.js
    - backend/utils/jwt.js
    - backend/utils/response.js
    - backend/.env.example
  </read_first>
  <action>
    Create `backend/controllers/authController.js`:
    ```js
    import User from '../models/User.js'
    import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
    import { sendSuccess, sendError } from '../utils/response.js'

    const REFRESH_COOKIE_OPTIONS = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/api/auth/refresh',
    }

    // ── POST /api/auth/register ──────────────────────────────────────────────────
    export const register = async (req, res) => {
      try {
        const { name, email, password, college, targetRole } = req.body

        if (!name || !email || !password) {
          return sendError(res, 'Name, email, and password are required', 400)
        }
        if (password.length < 6) {
          return sendError(res, 'Password must be at least 6 characters', 400)
        }

        const existing = await User.findOne({ email: email.toLowerCase() })
        if (existing) {
          return sendError(res, 'An account with this email already exists', 409)
        }

        const user = await User.create({
          name,
          email,
          passwordHash: password, // pre-save hook hashes it
          college: college || '',
          targetRole: targetRole || '',
        })

        const accessToken = signAccessToken(user._id)
        const refreshToken = signRefreshToken(user._id)

        // Store refresh token on user document
        user.refreshTokens = [refreshToken]
        await user.save({ validateBeforeSave: false })

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS)

        return sendSuccess(res, {
          accessToken,
          user: user.toSafeObject(),
        }, 201)
      } catch (err) {
        if (err.code === 11000) {
          return sendError(res, 'An account with this email already exists', 409)
        }
        return sendError(res, err.message, 500)
      }
    }

    // ── POST /api/auth/login ─────────────────────────────────────────────────────
    export const login = async (req, res) => {
      try {
        const { email, password } = req.body

        if (!email || !password) {
          return sendError(res, 'Email and password are required', 400)
        }

        // Explicitly select passwordHash (select: false by default)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokens')
        if (!user) {
          return sendError(res, 'Invalid email or password', 401)
        }

        const isMatch = await user.comparePassword(password)
        if (!isMatch) {
          return sendError(res, 'Invalid email or password', 401)
        }

        const accessToken = signAccessToken(user._id)
        const refreshToken = signRefreshToken(user._id)

        // Add new refresh token (keep last 5 for multi-device)
        user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken]
        await user.save({ validateBeforeSave: false })

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS)

        return sendSuccess(res, {
          accessToken,
          user: user.toSafeObject(),
        })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── POST /api/auth/logout ────────────────────────────────────────────────────
    export const logout = async (req, res) => {
      try {
        const token = req.cookies.refreshToken
        if (token) {
          // Revoke refresh token from DB
          await User.findByIdAndUpdate(req.user?._id, {
            $pull: { refreshTokens: token },
          })
        }
        res.clearCookie('refreshToken', { path: '/api/auth/refresh' })
        return sendSuccess(res, { message: 'Logged out successfully' })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── POST /api/auth/refresh ───────────────────────────────────────────────────
    export const refresh = async (req, res) => {
      try {
        const token = req.cookies.refreshToken
        if (!token) {
          return sendError(res, 'Refresh token required', 401)
        }

        let decoded
        try {
          decoded = verifyRefreshToken(token)
        } catch {
          res.clearCookie('refreshToken', { path: '/api/auth/refresh' })
          return sendError(res, 'Invalid or expired refresh token', 401)
        }

        const user = await User.findById(decoded.sub).select('+refreshTokens')
        if (!user || !user.refreshTokens.includes(token)) {
          // Possible token reuse attack — invalidate all tokens
          if (user) {
            user.refreshTokens = []
            await user.save({ validateBeforeSave: false })
          }
          res.clearCookie('refreshToken', { path: '/api/auth/refresh' })
          return sendError(res, 'Refresh token reuse detected. Please log in again.', 401)
        }

        // Rotate refresh token
        const newAccessToken = signAccessToken(user._id)
        const newRefreshToken = signRefreshToken(user._id)

        user.refreshTokens = user.refreshTokens.filter(t => t !== token).concat(newRefreshToken)
        await user.save({ validateBeforeSave: false })

        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS)

        return sendSuccess(res, { accessToken: newAccessToken })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }

    // ── GET /api/auth/me ─────────────────────────────────────────────────────────
    export const me = async (req, res) => {
      try {
        // req.user is set by protect middleware
        return sendSuccess(res, { user: req.user })
      } catch (err) {
        return sendError(res, err.message, 500)
      }
    }
    ```
  </action>
  <acceptance_criteria>
    - backend/controllers/authController.js exists
    - backend/controllers/authController.js contains `export const register`
    - backend/controllers/authController.js contains `export const login`
    - backend/controllers/authController.js contains `export const logout`
    - backend/controllers/authController.js contains `export const refresh`
    - backend/controllers/authController.js contains `export const me`
    - backend/controllers/authController.js contains `bcrypt` password comparison via `user.comparePassword`
    - backend/controllers/authController.js contains `refreshTokens` rotation logic
    - backend/controllers/authController.js contains `httpOnly: true` cookie setup
  </acceptance_criteria>
</task>

<task id="2.5">
  <title>Create auth router and wire into app.js</title>
  <read_first>
    - backend/controllers/authController.js
    - backend/middleware/auth.js
    - backend/app.js
  </read_first>
  <action>
    Create `backend/routes/auth.js`:
    ```js
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
    ```

    Update `backend/app.js` — replace the Phase 2 stub comment with the real import and mount:
    Find the line: `// Phase 2:  app.use('/api/auth', authRoutes)`
    Replace with:
    ```js
    import authRoutes from './routes/auth.js'
    ```
    (add at top of file with other imports)

    And replace the stub comment line in the routes section with:
    ```js
    app.use('/api/auth', authRoutes)
    ```
  </action>
  <acceptance_criteria>
    - backend/routes/auth.js exists
    - backend/routes/auth.js contains `router.post('/register', authLimiter, register)`
    - backend/routes/auth.js contains `router.post('/login', authLimiter, login)`
    - backend/routes/auth.js contains `router.post('/refresh', refresh)`
    - backend/routes/auth.js contains `router.get('/me', protect, me)`
    - backend/app.js contains `import authRoutes from './routes/auth.js'`
    - backend/app.js contains `app.use('/api/auth', authRoutes)`
  </acceptance_criteria>
</task>

## Verification

```bash
# Syntax check — app must load cleanly
cd backend && node --input-type=module --eval "import('./app.js').then(() => console.log('APP_OK'))"
```

Expected output: `APP_OK`

## must_haves
- [ ] User model with bcrypt pre-save hook (salt rounds 12) and `toSafeObject()` method
- [ ] JWT utility with sign/verify for both access and refresh tokens
- [ ] `protect` middleware verifies Bearer token and attaches `req.user`
- [ ] All 5 controller handlers: register, login, logout, refresh, me
- [ ] Refresh token rotation with reuse detection
- [ ] Auth rate limiter (10/15min) on register and login
- [ ] `app.js` mounts `/api/auth` router
