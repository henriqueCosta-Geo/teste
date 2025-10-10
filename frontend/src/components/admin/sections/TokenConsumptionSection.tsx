'use client'

import { Cpu, TrendingUp } from 'lucide-react'
import type { TokenConsumption } from '@/lib/admin-types'

interface TokenConsumptionSectionProps {
  data: TokenConsumption
}

export default function TokenConsumptionSection({ data }: TokenConsumptionSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        💰 Consumo de Tokens
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total de Tokens</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.total_tokens.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Input / Output</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.input_tokens.toLocaleString()} / {data.output_tokens.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
