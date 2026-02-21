import { AxiosError } from 'axios'

/**
 * Extract error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined
    const message = data?.message

    if (Array.isArray(message)) {
      return message.join(', ')
    }

    if (typeof message === 'string') {
      return message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}

/**
 * Log error to console with context
 */
export const logError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, error)
}
