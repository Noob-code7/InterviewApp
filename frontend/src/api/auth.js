import api from './axios.js'

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login:    (data) => api.post('/api/auth/login', data),
  logout:   ()     => api.post('/api/auth/logout'),
  refresh:  ()     => api.post('/api/auth/refresh'),
  me:       ()     => api.get('/api/auth/me'),
}
