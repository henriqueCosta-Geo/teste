'use client'

import { Bot, Clock } from 'lucide-react'
import type { AgentPerformance } from '@/lib/admin-types'

interface AgentsPerformanceSectionProps {
  data: AgentPerformance[]
}

export default function AgentsPerformanceSection({ data }: AgentsPerformanceSectionProps) {
  const cleanAgentName = (name: string) => {
    return name.replace(/Especialista\s+(em\s+)?/gi, '').trim()
  }

  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 95) return 'badge-green'
    if (rate >= 90) return 'badge-yellow'
    return 'badge-red'
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        ⚡ Performance dos Agentes
      </h2>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Agente
                </th>
                <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Mensagens
                </th>
                <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Tempo Médio
                </th>
                <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Taxa Sucesso
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((agent) => (
                <tr
                  key={agent.agent_id}
                  className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {cleanAgentName(agent.agent_name)}
                        </p>
                        {agent.team_name && (
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {agent.team_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {agent.total_messages}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {(agent.avg_execution_time_ms / 1000).toFixed(2)}s
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`badge ${getSuccessRateBadge(agent.success_rate)}`}>
                        {agent.success_rate.toFixed(1)}%
                      </span>
                      {agent.errors > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          ({agent.errors} erros)
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              <Bot className="h-12 w-12 mx-auto mb-3" />
              <p>Nenhum dado de performance disponível</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
