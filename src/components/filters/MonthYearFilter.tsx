import { DatePicker } from 'antd'
import { useFilters } from '@/contexts/FilterContext'
import { dayjs } from '@/utils/date'
import type { Dayjs } from 'dayjs'

interface MonthYearFilterProps {
  name: string
  label?: string
}

export const MonthYearFilter = ({ name, label }: MonthYearFilterProps) => {
  const { filters, setFilter, clearFilter } = useFilters()
  const monthYear = filters[name] as { month: number; year: number } | undefined

  const value = monthYear ? dayjs().month(monthYear.month - 1).year(monthYear.year) : null

  const handleChange = (date: Dayjs | null) => {
    if (date) {
      setFilter(name, {
        month: date.month() + 1, // dayjs months are 0-indexed
        year: date.year(),
      })
    } else {
      clearFilter(name)
    }
  }

  return (
    <DatePicker
      placeholder={label || 'Select Month/Year'}
      value={value}
      onChange={handleChange}
      picker="month"
      format="MMM YYYY"
      allowClear
    />
  )
}
