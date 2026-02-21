import api from '@/api/axios'

export interface HealthCheckResponse {
  status: string
  timestamp: string
  uptime: number
  environment: string
}

/**
 * Check if the backend API is healthy and responding
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await api.get<HealthCheckResponse>('/health')
    return response.data.status === 'ok'
  } catch (error) {
    console.error('Backend health check failed:', error)
    return false
  }
}

/**
 * Get detailed health information
 */
export async function getHealthInfo(): Promise<HealthCheckResponse | null> {
  try {
    const response = await api.get<HealthCheckResponse>('/health')
    return response.data
  } catch (error) {
    console.error('Failed to get health info:', error)
    return null
  }
}
