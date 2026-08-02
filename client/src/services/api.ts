import axios from 'axios'
import { firebaseAuth, firebaseAuthReady } from './firebase'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' })

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}

const storedToken = localStorage.getItem('fd_token')
setAuthToken(storedToken)

api.interceptors.request.use(async (config) => {
  const user = firebaseAuth.currentUser
  if (user) config.headers.Authorization = `Bearer ${await user.getIdToken()}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = String(error.config?.url || '')
    const hadBearerToken = Boolean(error.config?.headers?.Authorization)
    if (error.response?.status === 401 && hadBearerToken && !requestUrl.startsWith('/auth/')) {
      const original = error.config as any
      if (!original.__fdRetriedAfterRefresh) {
        original.__fdRetriedAfterRefresh = true
        try {
          const user = firebaseAuth.currentUser || await firebaseAuthReady
          if (user) {
            const token = await user.getIdToken(true)
            localStorage.setItem('fd_token', token)
            setAuthToken(token)
            original.headers = original.headers || {}
            original.headers.Authorization = `Bearer ${token}`
            return api.request(original)
          }
        } catch { /* A real expired/revoked session is handled below. */ }
      }
      localStorage.removeItem('fd_token')
      setAuthToken(null)
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  }
)

export default api
