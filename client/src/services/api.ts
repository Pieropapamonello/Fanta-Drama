import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' })

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}

const storedToken = localStorage.getItem('fd_token')
setAuthToken(storedToken)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fd_token')
      setAuthToken(null)
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  }
)

export default api
