import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useFilters } from '@/contexts/FilterContext'

interface SearchFilterProps {
  name: string
  placeholder?: string
}

export const SearchFilter = ({ name, placeholder }: SearchFilterProps) => {
  const { filters, setFilter, clearFilter } = useFilters()
  const [localValue, setLocalValue] = useState('')

  // Sync with global filter
  useEffect(() => {
    setLocalValue((filters[name] as string) || '')
  }, [filters, name])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue) {
        setFilter(name, localValue)
      } else {
        clearFilter(name)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [localValue, name, setFilter, clearFilter])

  return (
    <Input
      placeholder={placeholder || 'Search...'}
      prefix={<SearchOutlined />}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      allowClear
      style={{ width: 300 }}
    />
  )
}
