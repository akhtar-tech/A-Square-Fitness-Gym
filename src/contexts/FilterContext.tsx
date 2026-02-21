import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dayjs } from 'dayjs'
import { dayjs } from '@/utils/date'

export interface FilterValues {
  search?: string
  dateRange?: [Dayjs | null, Dayjs | null]
  monthYear?: { month: number; year: number }
  [key: string]: any
}

interface FilterContextType {
  filters: FilterValues
  setFilter: (name: string, value: any) => void
  clearFilter: (name: string) => void
  clearAllFilters: () => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<FilterValues>({})
  const initialLoadRef = useRef(true)

  // Load filters from URL ONLY on initial mount
  useEffect(() => {
    if (!initialLoadRef.current) return
    initialLoadRef.current = false

    const params = new URLSearchParams(location.search)
    const newFilters: FilterValues = {}

    // Parse search param
    const search = params.get('search')
    if (search) newFilters.search = search

    // Parse dateRange params
    const dateFrom = params.get('dateFrom')
    const dateTo = params.get('dateTo')
    if (dateFrom || dateTo) {
      newFilters.dateRange = [
        dateFrom ? dayjs(dateFrom) : null,
        dateTo ? dayjs(dateTo) : null,
      ]
    }

    // Parse month/year params
    const month = params.get('month')
    const year = params.get('year')
    if (month && year) {
      newFilters.monthYear = { month: parseInt(month), year: parseInt(year) }
    }

    setFilters(newFilters)
  }, [])

  // Sync filters to URL
  const syncToURL = (updatedFilters: FilterValues) => {
    const params = new URLSearchParams(location.search)

    // Sync search
    if (updatedFilters.search) {
      params.set('search', updatedFilters.search)
    } else {
      params.delete('search')
    }

    // Sync dateRange
    if (updatedFilters.dateRange) {
      const [from, to] = updatedFilters.dateRange
      if (from) params.set('dateFrom', from.format('YYYY-MM-DD'))
      else params.delete('dateFrom')
      if (to) params.set('dateTo', to.format('YYYY-MM-DD'))
      else params.delete('dateTo')
    } else {
      params.delete('dateFrom')
      params.delete('dateTo')
    }

    // Sync month/year
    if (updatedFilters.monthYear) {
      params.set('month', String(updatedFilters.monthYear.month))
      params.set('year', String(updatedFilters.monthYear.year))
    } else {
      params.delete('month')
      params.delete('year')
    }

    navigate({ search: params.toString() }, { replace: true })
  }

  const setFilter = (name: string, value: any) => {
    const updatedFilters = { ...filters, [name]: value }
    setFilters(updatedFilters)
    syncToURL(updatedFilters)
  }

  const clearFilter = (name: string) => {
    const updatedFilters = { ...filters }
    delete updatedFilters[name]
    setFilters(updatedFilters)
    syncToURL(updatedFilters)
  }

  const clearAllFilters = () => {
    setFilters({})
    navigate({ search: '' }, { replace: true })
  }

  return (
    <FilterContext.Provider value={{ filters, setFilter, clearFilter, clearAllFilters }}>
      {children}
    </FilterContext.Provider>
  )
}

export const useFilters = () => {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider')
  }
  return context
}
