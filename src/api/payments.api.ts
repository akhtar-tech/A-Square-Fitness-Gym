import api from './axios'

export interface Payment {
  id: string
  amount: number
  method: string
  note?: string
  paidAt: string
  createdAt: string
  clientId: string
  client: { name: string; phone: string; photoFilename?: string | null; entryNumber?: string | null }
}

export interface CreatePaymentPayload {
  clientId: string
  amount: number
  method?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER'
  note?: string
  paidAt?: string
  extendMembership?: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  newEndDate?: string
}

export interface UpdatePaymentPayload {
  amount?: number
  method?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER'
  note?: string
  paidAt?: string
}

export const paymentsApi = {
  list: (params?: { clientId?: string; month?: number; year?: number }) =>
    api.get<Payment[]>('/payments', { params }),

  getOne: (id: string) =>
    api.get<Payment>(`/payments/${id}`),

  create: (data: CreatePaymentPayload) =>
    api.post<Payment>('/payments', data),

  update: (id: string, data: UpdatePaymentPayload) =>
    api.patch<Payment>(`/payments/${id}`, data),

  delete: (id: string) =>
    api.delete(`/payments/${id}`),
}
