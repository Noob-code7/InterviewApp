import api from './axios.js'
import { storageApi } from './storage.js'

export const interviewApi = {
  generateQuestions: (sessionId) => api.post(`/api/sessions/${sessionId}/questions`),
  
  uploadAnswer: async (sessionId, questionId, videoBlob) => {
    try {
      // 1. Upload media directly via storageApi (Cloudflare R2 or local fallback)
      const { key, fileUrl } = await storageApi.uploadDirectToR2({
        blob: videoBlob,
        resourceType: 'video',
        interviewId: sessionId,
        questionId,
        contentType: videoBlob.type || 'video/webm',
      })

      // 2. Submit saved storage key / URL to backend answer endpoint
      return api.post(`/api/sessions/${sessionId}/answers/${questionId}`, {
        videoUrl: fileUrl || key,
        storageKey: key,
      })
    } catch (err) {
      console.warn('[InterviewApi] Direct R2 upload fallback to multipart form data:', err.message)
      const formData = new FormData()
      formData.append('video', videoBlob, 'answer.webm')
      return api.post(`/api/sessions/${sessionId}/answers/${questionId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    }
  },

  submitWriting: (sessionId, text) => api.post(`/api/sessions/${sessionId}/writing`, { text }),

  getReport: (sessionId) => api.get(`/api/reports/${sessionId}`),
}
