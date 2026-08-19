import api from './axios.js'



export const reportsApi = {

  get: (sessionId) =>api.get(`/api/reports/${sessionId}`),

}