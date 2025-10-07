'use client'

import { Search, Database, TrendingUp, FileText } from 'lucide-react'
import type { RAGAnalytics } from '@/lib/admin-types'

interface RAGAnalyticsSectionProps {
  data: RAGAnalytics
}

export default function RAGAnalyticsSection({ data }: RAGAnalyticsSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        🔍 RAG Analytics
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Queries com RAG
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.total_rag_queries}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Taxa de Uso RAG
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.rag_usage_rate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Score Médio
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {(data.avg_similarity_score * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sources */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            📚 Fontes Mais Consultadas
          </h3>
          <div className="space-y-3">
            {data.top_sources.slice(0, 5).map((source, index) => (
              <div
                key={source.collection}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {source.collection}
                    </p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {source.queries} queries
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Score médio: {(source.avg_score * 100).toFixed(1)}%
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {source.agents_using.length} agentes
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{
                      width: `${Math.min(
                        (source.queries / (data.top_sources[0]?.queries || 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {data.top_sources.length === 0 && (
              <p className="text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                Nenhuma fonte consultada
              </p>
            )}
          </div>
        </div>

        {/* Collections Stats */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            📦 Estatísticas de Collections
          </h3>
          <div className="space-y-3">
            {data.collections_stats.map((collection) => (
              <div
                key={collection.collection_id}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {collection.collection_name}
                    </p>
                  </div>
                  <span className="text-sm px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                    {collection.rag_queries} queries
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Arquivos
                    </p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {collection.files_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Chunks
                    </p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {collection.chunks_count.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {data.collections_stats.length === 0 && (
              <p className="text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                Nenhuma collection disponível
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
