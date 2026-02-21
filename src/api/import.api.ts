import api from './axios'

export type ImportStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** Build a URL to display a photo stored in the backend uploads folder */
export const photoUrl = (filename: string | null): string | null => {
  if (!filename) return null
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '')
  return `${base}/uploads/${filename}`
}

export interface ImportedClient {
  id: string
  entryNumber: string | null
  clientName: string | null
  clientPhone: string | null
  addressRaw: string | null
  membershipDurationMonths: number
  membershipAmount: number | null
  paymentMode: string | null
  joinDate: string | null
  photoFilename: string | null
  sender: string | null
  confidenceScore: number
  needsManualReview: boolean
  status: ImportStatus
  reviewNote: string | null
  resolvedClientId: string | null
  createdAt: string
}

export interface ImportResult {
  imported: number
  skipped: number
  autoApproved: number
  needsReview: number
}

/** Records grouped by entry number — returned by GET /import */
export interface GroupedImport {
  entryNumber: string | null
  count: number
  records: ImportedClient[]
}

/** Result of POST /import/enrich-from-entry */
export interface EnrichResult {
  processed: number
  alreadyInDb: number
  enriched: number
  autoApproved: number
  notFound: number
}

export interface ReviewPayload {
  clientName?: string
  clientPhone?: string
  addressRaw?: string
  membershipDurationMonths?: number
  membershipAmount?: number
  paymentMode?: string
  reviewNote?: string
}

export interface ApprovePayload {
  clientName?: string
  clientPhone?: string
  reviewNote?: string
}

export const importApi = {
  /** Upload a WhatsApp .txt file for parsing */
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ImportResult>('/import/whatsapp', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Import from a server-side folder path (photos already on disk) */
  importFromPath: (folderPath: string) =>
    api.post<ImportResult>('/import/from-path', { folderPath }),

  /** List all staging records grouped by entry number, optionally filtered by status */
  list: (status?: ImportStatus) =>
    api.get<GroupedImport[]>('/import', { params: status ? { status } : {} }),

  /** List only PENDING records */
  pending: () => api.get<ImportedClient[]>('/import/pending'),

  /** Get a single staging record */
  getOne: (id: string) => api.get<ImportedClient>(`/import/${id}`),

  /** Patch a staging record (add name/phone, fix any field) */
  review: (id: string, data: ReviewPayload) =>
    api.patch<ImportedClient>(`/import/${id}`, data),

  /** Approve → creates real Client + Payment atomically */
  approve: (id: string, data: ApprovePayload) =>
    api.post<{ message: string; clientId: string }>(`/import/${id}/approve`, data),

  /** Reject an entry */
  reject: (id: string, note?: string) =>
    api.post<ImportedClient>(`/import/${id}/reject`, { note }),

  /**
   * Enrich PENDING fees records by cross-referencing the entry chat folder.
   * Looks up each entry number and copies name / phone / address.
   * Auto-approves records that become complete.
   */
  enrichFromEntry: (entryFolderPath: string) =>
    api.post<EnrichResult>('/import/enrich-from-entry', { entryFolderPath }),
}
