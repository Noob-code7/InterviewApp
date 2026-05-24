import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import path from 'path'

const BUCKET = process.env.S3_BUCKET
const REGION = process.env.AWS_REGION || 'us-east-1'
const CDN_URL = process.env.CDN_URL || ''
const SIGNED_URL_EXPIRY = parseInt(process.env.SIGNED_URL_EXPIRY || '86400', 10)

const s3 = new S3Client({ region: REGION })

export async function uploadBuffer(buffer, key, contentType = 'application/octet-stream') {
  if (!BUCKET) throw new Error('S3_BUCKET not configured')

  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Keep objects private; use signed URLs for access
  })

  await s3.send(cmd)

  // If a CDN URL is provided, return that mapping (assumes CDN origin maps bucket path)
  if (CDN_URL) {
    return { key, url: `${CDN_URL.replace(/\/$/, '')}/${key}` }
  }

  // Otherwise, generate a signed URL
  const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  const url = await getSignedUrl(s3, getCmd, { expiresIn: SIGNED_URL_EXPIRY })
  return { key, url }
}

export function makeKeyForAnswer(sessionId, filename) {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  return `answers/${sessionId}/${Date.now()}-${safeName}`
}

export default { uploadBuffer, makeKeyForAnswer }
