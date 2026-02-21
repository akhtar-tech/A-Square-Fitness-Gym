import api from './axios'

export interface DashboardStats {
  clients: {
    total: number
    active: number
    expired: number
    newThisMonth: number
    expiringSoon: number
    expiresToday: number
  }
  revenue: {
    thisMonth: number
    allTime: number
  }
  expenses: {
    thisMonth: number
  }
  profit: {
    thisMonth: number
  }
}

export interface TrendPoint {
  month: string
  revenue: number
  expenses: number
  newClients: number
}

export const dashboardApi = {
  stats: () =>
    api.get<DashboardStats>('/dashboard/stats'),

  trend: (months = 6) =>
    api.get<TrendPoint[]>('/dashboard/trend', { params: { months } }),
}
