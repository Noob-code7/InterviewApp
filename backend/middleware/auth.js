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
