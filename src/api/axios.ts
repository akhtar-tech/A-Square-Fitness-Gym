import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 → clear token and redirect to login
// On 429 → add helpful error message for rate limiting
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      //window.location.href = '/login'
    }

    // Handle rate limiting
    if (error.response?.status === 429) {
      error.message = 'Too many requests. Please wait a moment and try again.'
    }

    return Promise.reject(error)
  },
)

export default api
