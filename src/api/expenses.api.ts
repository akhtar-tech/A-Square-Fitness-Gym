import api from './axios'

export type ExpenseCategory =
  | 'RENT'
  | 'UTILITIES'
  | 'EQUIPMENT'
  | 'SALARIES'
  | 'MAINTENANCE'
  | 'MARKETING'
  | 'OTHER'

export interface Expense {
  id: string
  title: string
  amount: number
  category: ExpenseCategory
  description?: string
  date: string
  createdAt: string
}

export interface ExpensesResponse {
  expenses: Expense[]
  total: number
}

export interface CreateExpensePayload {
  title: string
  amount: number
  category: ExpenseCategory
  description?: string
  date?: string
}

export const expensesApi = {
  list: (params?: { month?: number; year?: number; category?: string }) =>
    api.get<ExpensesResponse>('/expenses', { params }),

  getOne: (id: string) =>
    api.get<Expense>(`/expenses/${id}`),

  create: (data: CreateExpensePayload) =>
    api.post<Expense>('/expenses', data),

  update: (id: string, data: Partial<CreateExpensePayload>) =>
    api.patch<Expense>(`/expenses/${id}`, data),

  delete: (id: string) =>
    api.delete(`/expenses/${id}`),
}
