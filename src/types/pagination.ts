export interface PaginationParams {
  skip?: number
  take?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  currentTabTotal: number
  expiringTodayTotal: number
  expiredTotal: number
  expiringSoonTotal: number
  skip: number
  take: number
  hasMore: boolean
}

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100
