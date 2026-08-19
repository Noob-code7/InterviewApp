import api from './axios.js'
import { storageApi } from './storage.js'

export const interviewApi = {
  generateQuestions: (sessionId) => api.post(`/api/sessions/${sessionId}/questions`),

  getWritingSession: (sessionId) => api.get(`/api/sessions/${sessionId}`),

  uploadAnswer: async (sessionId, questionId, videoBlob, options = {}) => {
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
        ...options,
      })
    } catch (err) {
      console.warn('[InterviewApi] Direct R2 upload fallback to multipart form data:', err.message)
      const formData = new FormData()
      formData.append('video', videoBlob, 'answer.webm')
      if (options.isFollowUp) {
        formData.append('isFollowUp', 'true')
        if (options.turn != null) formData.append('turn', String(options.turn))
      }
      if (options.questionIndex != null) formData.append('questionIndex', String(options.questionIndex))
      if (options.questionText) formData.append('questionText', options.questionText)

      return api.post(`/api/sessions/${sessionId}/answers/${questionId}`, formData)
    }
  },

  submitWriting: (sessionId, text) => api.post(`/api/sessions/${sessionId}/writing`, { text }),

  getReport: (sessionId) => api.get(`/api/reports/${sessionId}`),
}
