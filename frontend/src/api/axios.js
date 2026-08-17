import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
})

// ── Request interceptor — attach access token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}, Promise.reject)

// ── Response interceptor — auto-refresh on 401, queue concurrent requests ────
let isRefreshing = false
let refreshQueue = []

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  )
  refreshQueue = []
}

const safeRedirectToLogin = () => {
  localStorage.removeItem('accessToken')
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/login' &&
    window.location.pathname !== '/register'
  ) {
    window.location.href = '/login'
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (!original) {
      return Promise.reject(error)
    }

    const isAuthEndpoint = original.url?.includes('/api/auth/')

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await api.post('/api/auth/refresh')
        const newToken = data?.data?.accessToken
        if (newToken) {
          localStorage.setItem('accessToken', newToken)
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`
          processQueue(null, newToken)
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        safeRedirectToLogin()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // If auth endpoint itself returned 401, safely handle login redirect without looping
    if (error.response?.status === 401 && isAuthEndpoint) {
      safeRedirectToLogin()
    }

    return Promise.reject(error)
  }
)

export default api
