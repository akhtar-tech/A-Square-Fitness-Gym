import { useState } from 'react'
import { DatePicker } from 'antd'
import { useFilters } from '@/contexts/FilterContext'
import { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

interface DateRangeFilterProps {
  name: string
  label?: string
}

export const DateRangeFilter = ({ name, label }: DateRangeFilterProps) => {
  const { filters, setFilter, clearFilter } = useFilters()
  const [isOpen, setIsOpen] = useState(false)
  const [tempValue, setTempValue] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const savedValue = (filters[name] as [Dayjs | null, Dayjs | null]) || null
  const displayValue = isOpen ? tempValue : savedValue

  const handleCalendarChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    // Update temporary value during selection (doesn't sync to URL)
    setTempValue(dates)
  }

  const handleChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    // Only called when selection is complete (both dates selected or cleared)
    setTempValue(null)
    if (dates && (dates[0] || dates[1])) {
      setFilter(name, dates)
    } else {
      clearFilter(name)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Reset temp value when closing without completing selection
      setTempValue(null)
    }
  }

  return (
    <RangePicker
      placeholder={[label ? `${label} from` : 'From', label ? `${label} to` : 'To']}
      value={displayValue}
      onCalendarChange={handleCalendarChange}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
      format="DD MMM YYYY"
      allowClear
    />
  )
}
