import api from './axios.js'

export const storageApi = {
  /**
   * Requests a presigned upload URL from backend and performs direct upload to Cloudflare R2 (or local fallback).
   */
  uploadDirectToR2: async ({ blob, resourceType, interviewId, questionId, contentType }) => {
    const type = contentType || blob.type || 'video/webm'
    
    // 1. Request presigned upload URL from backend
    const { data } = await api.post('/api/storage/presigned-url', {
      resourceType,
      interviewId,
      questionId,
      contentType: type,
    })

    const { uploadUrl, key, fileUrl, isDirectR2 } = data.data

    // 2. Direct R2 upload vs Local Fallback upload
    if (isDirectR2) {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
        },
        body: blob,
      })

      if (!response.ok) {
        throw new Error(`Direct R2 upload failed with status ${response.status}`)
      }
    } else {
      // Local fallback mode: POST to backend local storage route (/api/storage/local-upload)
      const formData = new FormData()
      formData.append('file', blob, pathNameFromKey(key))
      formData.append('key', key)
      
      const localRes = await api.post('/api/storage/local-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      
      return { key, fileUrl: localRes.data.data.fileUrl || fileUrl || key }
    }

    return { key, fileUrl }
  },
}

function pathNameFromKey(key) {
  const parts = key.split('/')
  return parts[parts.length - 1] || 'media.webm'
}
