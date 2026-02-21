/**
 * Build a URL to display a photo stored in the backend uploads folder
 */
export const getPhotoUrl = (filename: string | null | undefined): string | null => {
  if (!filename) return null
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1')
    .replace('/api/v1', '')
  return `${base}/uploads/${filename}`
}
