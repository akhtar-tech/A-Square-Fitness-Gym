export interface FilterConfig {
  type: 'search' | 'dateRange' | 'select' | 'monthYear'
  name: string
  label?: string
  placeholder?: string
  options?: Array<{ value: string; label: string }>
}

export interface RouteFilterConfig {
  [route: string]: {
    filters: FilterConfig[]
  }
}

export const filterConfig: RouteFilterConfig = {
  '/clients': {
    filters: [
      {
        type: 'search',
        name: 'search',
        placeholder: 'Search by entry #, name or phone...',
      },
      {
        type: 'dateRange',
        name: 'dateRange',
        label: 'Expiry Date',
      },
    ],
  },
  '/payments': {
    filters: [
      {
        type: 'search',
        name: 'search',
        placeholder: 'Search by name, phone, entry #...',
      },
      {
        type: 'dateRange',
        name: 'dateRange',
        label: 'Payment Date',
      },
      {
        type: 'monthYear',
        name: 'monthYear',
        label: 'Month/Year',
      },
    ],
  },
  '/expenses': {
    filters: [
      {
        type: 'search',
        name: 'search',
        placeholder: 'Search expenses...',
      },
      {
        type: 'dateRange',
        name: 'dateRange',
        label: 'Expense Date',
      },
      {
        type: 'monthYear',
        name: 'monthYear',
        label: 'Month/Year',
      },
    ],
  },
}

export const getFiltersForRoute = (pathname: string): FilterConfig[] => {
  const config = filterConfig[pathname]
  return config?.filters || []
}
