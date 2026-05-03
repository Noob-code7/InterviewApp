import api from './axios.js'

export const sessionsApi = {
  create:       (data) => api.post('/api/sessions', data),
  list:         (params) => api.get('/api/sessions', { params }),
  get:          (id)  => api.get(`/api/sessions/${id}`),
  getStats:     ()    => api.get('/api/sessions/stats'),
  updateStatus: (id, status) => api.patch(`/api/sessions/${id}/status`, { status }),
}
