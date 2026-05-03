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
