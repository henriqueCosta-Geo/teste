'use client'

import { Calendar } from 'lucide-react'
import type { DashboardFilters } from '@/lib/admin-types'

interface DashboardFiltersProps {
  filters: DashboardFilters
  onChange: (filters: DashboardFilters) => void
}

export default function DashboardFiltersComponent({ filters, onChange }: DashboardFiltersProps) {
  const periods = [
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
    { value: '365d', label: 'Último ano' },
  ]

  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={20} style={{ color: 'var(--text-secondary)' }} />
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            Período:
          </span>
        </div>

        <div className="flex gap-2">
          {periods.map((period) => (
            <button
              key={period.value}
              onClick={() => onChange({ ...filters, period: period.value as any })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filters.period === period.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
