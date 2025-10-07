'use client'

import { DollarSign, Cpu, TrendingUp } from 'lucide-react'
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Custo Estimado</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                ${data.estimated_cost.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Model */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Por Modelo
          </h3>
          <div className="space-y-3">
            {Object.entries(data.by_model).map(([model, stats]) => (
              <div key={model} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {model}
                  </span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    ${stats.cost.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{stats.tokens.toLocaleString()} tokens</span>
                  <span>{stats.messages} mensagens</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${(stats.tokens / data.total_tokens) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Agents */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Top Agentes (Consumo)
          </h3>
          <div className="space-y-3">
            {data.by_agent.slice(0, 5).map((agent) => (
              <div key={agent.agent_id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {agent.agent_name}
                    </span>
                    {agent.team_name && (
                      <span className="ml-2 text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                        {agent.team_name}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {agent.tokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{agent.messages} mensagens</span>
                  <span>{agent.avg_tokens_per_message.toFixed(0)} tokens/msg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
