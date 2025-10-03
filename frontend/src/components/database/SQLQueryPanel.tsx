'use client'

import { useState } from 'react'
import { Play, AlertCircle, CheckCircle, Clock, Copy, Download } from 'lucide-react'

interface QueryResult {
  columns: string[]
  rows: Record<string, any>[]
  row_count: number
  execution_time_ms?: number
}

interface SQLQueryPanelProps {
  className?: string
}

export function SQLQueryPanel({ className = '' }: SQLQueryPanelProps) {
  const [query, setQuery] = useState('SELECT * FROM collections LIMIT 10;')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeQuery = async () => {
    if (!query.trim()) {
      setError('Digite uma query SQL')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // ✅ Usar rota de API do Next.js (proxy para o backend)
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Erro ao executar query')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter para executar
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }

    // Tab para indentação
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newQuery = query.substring(0, start) + '  ' + query.substring(end)
      setQuery(newQuery)
      setTimeout(() => {
        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2
      }, 0)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadCSV = () => {
    if (!result) return

    const csv = [
      result.columns.join(','),
      ...result.rows.map(row =>
        result.columns.map(col => {
          const value = row[col]
          if (value === null || value === undefined) return ''
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_result_${new Date().getTime()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sampleQueries = [
    {
      name: 'Todas as coleções',
      query: 'SELECT * FROM collections ORDER BY created_at DESC;'
    },
    {
      name: 'Arquivos por coleção',
      query: `SELECT
  c.name as collection,
  COUNT(f.id) as file_count,
  SUM(f.file_size) as total_size
FROM collections c
LEFT JOIN files f ON c.id = f.collection_id
GROUP BY c.id, c.name;`
    },
    {
      name: 'Chunks por arquivo',
      query: `SELECT
  f.original_name,
  COUNT(ch.id) as chunk_count
FROM files f
LEFT JOIN chunks ch ON f.id = ch.file_id
GROUP BY f.id, f.original_name
ORDER BY chunk_count DESC;`
    },
    {
      name: 'Estatísticas gerais',
      query: `SELECT
  'Collections' as entity,
  COUNT(*) as count
FROM collections
UNION ALL
SELECT 'Files', COUNT(*) FROM files
UNION ALL
SELECT 'Chunks', COUNT(*) FROM chunks;`
    }
  ]

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">SQL Query Editor</h2>
        <p className="text-sm text-gray-500">
          Execute queries SELECT no banco de dados PostgreSQL
        </p>
      </div>

      {/* Query Editor */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Query SQL</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(query)}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copiar
            </button>
            <span className="text-xs text-gray-500">Ctrl+Enter para executar</span>
          </div>
        </div>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-32 px-3 py-2 font-mono text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          placeholder="SELECT * FROM tabela WHERE ..."
        />

        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((sample, idx) => (
              <button
                key={idx}
                onClick={() => setQuery(sample.query)}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                {sample.name}
              </button>
            ))}
          </div>

          <button
            onClick={executeQuery}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Executando...' : 'Executar'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-1">Erro na execução</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium">{result.row_count} linhas</span>
                </div>
                {result.execution_time_ms !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{result.execution_time_ms}ms</span>
                  </div>
                )}
              </div>

              {result.rows.length > 0 && (
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              )}
            </div>

            {result.rows.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {result.columns.map((col, idx) => (
                          <th
                            key={idx}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-gray-50">
                          {result.columns.map((col, colIdx) => (
                            <td
                              key={colIdx}
                              className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                            >
                              {row[col] === null || row[col] === undefined ? (
                                <span className="text-gray-400 italic">null</span>
                              ) : typeof row[col] === 'boolean' ? (
                                <span className={row[col] ? 'text-green-600' : 'text-red-600'}>
                                  {row[col].toString()}
                                </span>
                              ) : (
                                String(row[col])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        )}

        {!result && !error && !loading && (
          <div className="text-center py-12 text-gray-400">
            Execute uma query para ver os resultados
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        )}
      </div>
    </div>
  )
}
