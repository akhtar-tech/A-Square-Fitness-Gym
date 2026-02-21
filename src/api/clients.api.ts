import api from './axios'
import { getPhotoUrl } from '@/utils/urls'
import { PaginatedResponse, PaginationParams } from '@/types/pagination'

/** Build a URL to display a photo stored in the backend uploads folder */
export const clientPhotoUrl = getPhotoUrl

export interface Client {
  id: string
  name: string
  phone: string
  email?: string
  membershipType: string  // cache — derived from latest payment
  startDate: string
  endDate: string         // cache — derived from latest payment
  isActive: boolean
  createdAt: string
  photoFilename?: string | null
  entryNumber?: string | null
  notes?: string | null
  // payments — last 1 returned in list endpoint, last 10 in getOne
  payments?: Array<{
    id: string
    amount: number
    paidAt: string
    method: string
    note?: string | null
    membershipType?: string | null
    endDate?: string | null
  }>
}

export interface CreateClientPayload {
  name: string
  phone: string
  email?: string
  membershipType: 'monthly' | 'quarterly' | 'yearly' | 'custom'
  initialAmount: number
  initialPaymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER'
  startDate: string
  endDate?: string
  notes?: string
  photoFilename?: string
  entryNumber?: string
}

export const clientsApi = {
  list: (params?: { active?: boolean; search?: string, from?: string } & PaginationParams) =>
    api.get<PaginatedResponse<Client>>('/clients', { params }),

  getOne: (id: string) =>
    api.get<Client>(`/clients/${id}`),

  create: (data: CreateClientPayload) =>
    api.post<Client>('/clients', data),

  update: (id: string, data: Partial<CreateClientPayload> & { isActive?: boolean }) =>
    api.patch<Client>(`/clients/${id}`, data),

  delete: (id: string) =>
    api.delete(`/clients/${id}`),

  expiringSoon: () =>
    api.get<Pick<Client, 'id' | 'name' | 'phone' | 'endDate' | 'membershipType'>[]>(
      '/clients/expiring-soon',
    ),

  /** Upload a client photo; returns { filename } */
  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ filename: string }>('/clients/upload-photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
