import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')

// Read R2 environment configuration
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_DOMAIN,
} = process.env

const isR2Configured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
)

let s3Client = null
if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
} else {
  console.log('[StorageService] Cloudflare R2 credentials not set. Using local disk fallback.')
}

export const storageService = {
  isR2Configured: () => isR2Configured,

  /**
   * Generates a pre-signed URL for direct browser PUT upload.
   */
  getPresignedUploadUrl: async ({ key, contentType, expiresIn = 900 }) => {
    if (!isR2Configured) {
      // Local fallback: returns local backend endpoint URL
      return {
        uploadUrl: `/api/storage/local-upload?key=${encodeURIComponent(key)}`,
        key,
        fileUrl: `/uploads/${path.basename(key)}`,
        isDirectR2: false,
      }
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn })
    const fileUrl = R2_PUBLIC_DOMAIN
      ? `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${key}`
      : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`

    return {
      uploadUrl,
      key,
      fileUrl,
      isDirectR2: true,
    }
  },

  /**
   * Generates a pre-signed URL for reading/downloading private objects.
   */
  getPresignedDownloadUrl: async ({ key, expiresIn = 3600 }) => {
    if (!isR2Configured) {
      return `/uploads/${path.basename(key)}`
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    return getSignedUrl(s3Client, command, { expiresIn })
  },

  /**
   * Deletes an object from Cloudflare R2 or local disk storage.
   */
  deleteObject: async ({ key }) => {
    if (!isR2Configured) {
      const localPath = path.join(uploadsDir, path.basename(key))
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath)
      }
      return true
    }

    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)
    return true
  },
}
