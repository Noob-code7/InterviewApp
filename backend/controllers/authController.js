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

    // Add new refresh token (keep last 5 for multi-device support)
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
