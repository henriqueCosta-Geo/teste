'use client'

import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import type { QualityMetrics } from '@/lib/admin-types'

interface QualityMetricsSectionProps {
  data: QualityMetrics
}

export default function QualityMetricsSection({ data }: QualityMetricsSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        ⚠️ Qualidade & Erros
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Taxa de Sucesso
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {data.success_rate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Bem-sucedidas</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.successful_messages}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Falhas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {data.failed_messages}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Queries Lentas</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.slow_queries.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Errors */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            Erros Recentes
          </h3>

          {data.errors.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.errors.map((error) => (
                <div
                  key={error.mensagem_id}
                  className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-red-600 dark:text-red-400">
                        {error.agent_name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Chat: {error.chat_id}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300 rounded">
                      {new Date(error.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                    {error.error || 'Erro desconhecido'}
                  </p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <Clock className="h-3 w-3" />
                    <span>{error.execution_time_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600 dark:text-green-400" />
              <p className="text-green-600 dark:text-green-400 font-medium">
                Nenhum erro registrado! 🎉
              </p>
            </div>
          )}
        </div>

        {/* Slow Queries */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            Queries Mais Lentas
          </h3>

          {data.slow_queries.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.slow_queries.map((query) => (
                <div
                  key={query.mensagem_id}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {query.agent_name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Chat: {query.chat_id}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded font-semibold">
                      {(query.execution_time_ms / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {query.tokens.toLocaleString()} tokens
                    </span>
                    {query.rag_used && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs">
                        RAG
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(query.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-tertiary)' }}>
                Nenhuma query lenta detectada
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
