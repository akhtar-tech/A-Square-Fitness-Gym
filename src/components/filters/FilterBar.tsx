import { Space, Button } from 'antd'
import { CloseCircleOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import { getFiltersForRoute } from '@/config/filterConfig'
import { SearchFilter } from './SearchFilter'
import { DateRangeFilter } from './DateRangeFilter'
import { MonthYearFilter } from './MonthYearFilter'
import { SelectFilter } from './SelectFilter'
import { useFilters } from '@/contexts/FilterContext'

export const FilterBar = () => {
  const location = useLocation()
  const { filters, clearAllFilters } = useFilters()
  const filterConfigs = getFiltersForRoute(location.pathname)

  if (filterConfigs.length === 0) return null

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div
      style={{
        background: '#fafafa',
        padding: '12px 24px',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Space size="middle" wrap>
        {filterConfigs.map((config) => {
          switch (config.type) {
            case 'search':
              return (
                <SearchFilter
                  key={config.name}
                  name={config.name}
                  placeholder={config.placeholder}
                />
              )
            case 'dateRange':
              return (
                <DateRangeFilter
                  key={config.name}
                  name={config.name}
                  label={config.label}
                />
              )
            case 'monthYear':
              return (
                <MonthYearFilter
                  key={config.name}
                  name={config.name}
                  label={config.label}
                />
              )
            case 'select':
              return (
                <SelectFilter
                  key={config.name}
                  name={config.name}
                  label={config.label}
                  options={config.options || []}
                />
              )
            default:
              return null
          }
        })}

        {hasActiveFilters && (
          <Button
            icon={<CloseCircleOutlined />}
            onClick={clearAllFilters}
            size="small"
            type="text"
          >
            Clear Filters
          </Button>
        )}
      </Space>
    </div>
  )
}
