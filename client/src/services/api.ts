import axios from 'axios'
import { firebaseAuth } from './firebase'

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
  (error) => {
    const requestUrl = String(error.config?.url || '')
    const hadBearerToken = Boolean(error.config?.headers?.Authorization)
    if (error.response?.status === 401 && hadBearerToken && !requestUrl.startsWith('/auth/')) {
      localStorage.removeItem('fd_token')
      setAuthToken(null)
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  }
)

export default api
