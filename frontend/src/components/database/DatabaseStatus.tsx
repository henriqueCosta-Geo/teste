'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface DatabaseStatusProps {
  className?: string
}

interface DatabaseInfo {
  status: 'success' | 'error'
  message: string
  info?: {
    database: {
      database_name: string
      schema_name: string
      postgres_version: string
    }
    tableCount: number
    sampleTables: Array<{
      table_name: string
      column_count: number
    }>
  }
  error?: string
}

export function DatabaseStatus({ className = '' }: DatabaseStatusProps) {
  const [status, setStatus] = useState<DatabaseInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const checkDatabaseStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/database/tables')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.tables) {
        setStatus({
          status: 'success',
          message: 'Database connection successful',
          info: {
            database: {
              database_name: 'PostgreSQL',
              schema_name: 'public',
              postgres_version: 'Connected'
            },
            tableCount: data.tables.length,
            sampleTables: data.tables.slice(0, 5).map((table: any) => ({
              table_name: table.name,
              column_count: table.columns.length
            }))
          }
        })
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.error('Database status error:', error)
      setStatus({
        status: 'error',
        message: 'Failed to connect to database',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkDatabaseStatus()
  }, [])

  const getStatusIcon = () => {
    if (loading) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
    }

    switch (status?.status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-600" />
    }
  }

  const getStatusText = () => {
    if (loading) return 'Checking connection...'
    return status?.message || 'Unknown status'
  }

  const getStatusBg = () => {
    if (loading) return 'bg-blue-50 border-blue-200'

    switch (status?.status) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-yellow-50 border-yellow-200'
    }
  }

  return (
    <div className={`p-3 border rounded-lg ${getStatusBg()} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-gray-900">
            {getStatusText()}
          </span>
        </div>

        <button
          onClick={checkDatabaseStatus}
          disabled={loading}
          className="p-1 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status?.status === 'success' && status.info && (
        <div className="mt-2 pt-2 border-t border-green-200">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <span className="font-medium">Database:</span> {status.info.database.database_name}
            </div>
            <div>
              <span className="font-medium">Tables:</span> {status.info.tableCount}
            </div>
          </div>

          {status.info.sampleTables.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">Recent tables:</div>
              <div className="flex flex-wrap gap-1">
                {status.info.sampleTables.map((table) => (
                  <span
                    key={table.table_name}
                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                  >
                    {table.table_name} ({table.column_count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status?.status === 'error' && (
        <div className="mt-2 pt-2 border-t border-red-200">
          <div className="text-xs text-red-700">
            {status.error || 'Connection failed'}
          </div>
        </div>
      )}
    </div>
  )
}