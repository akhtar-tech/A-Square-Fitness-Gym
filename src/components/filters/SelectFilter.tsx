import { Select } from 'antd'
import { useFilters } from '@/contexts/FilterContext'

const { Option } = Select

interface SelectFilterProps {
  name: string
  label?: string
  options: Array<{ value: string; label: string }>
}

export const SelectFilter = ({ name, label, options }: SelectFilterProps) => {
  const { filters, setFilter, clearFilter } = useFilters()
  const value = (filters[name] as string) || undefined

  const handleChange = (val: string | undefined) => {
    if (val) {
      setFilter(name, val)
    } else {
      clearFilter(name)
    }
  }

  return (
    <Select
      placeholder={label || 'Select...'}
      value={value}
      onChange={handleChange}
      allowClear
      style={{ width: 200 }}
    >
      {options.map((opt) => (
        <Option key={opt.value} value={opt.value}>
          {opt.label}
        </Option>
      ))}
    </Select>
  )
}
