import api from './axios.js'

export const interviewApi = {
  generateQuestions: (sessionId) => api.post(`/api/sessions/${sessionId}/questions`),
  
  uploadAnswer: (sessionId, questionId, videoBlob) => {
    const formData = new FormData()
    formData.append('video', videoBlob, 'answer.webm')
    
    return api.post(`/api/sessions/${sessionId}/answers/${questionId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
