'use client'

import { useState, useMemo } from 'react'
import { Edit, Trash2, ChevronLeft, ChevronRight, Key, Link, Calendar, MoreHorizontal } from 'lucide-react'
import { TableSchema, TableData } from './DatabaseViewer'

interface DataGridProps {
  schema: TableSchema
  data: TableData | null
  loading: boolean
  onEdit: (record: Record<string, any>) => void
  onDelete: (record: Record<string, any>) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function DataGrid({
  schema,
  data,
  loading,
  onEdit,
  onDelete,
  page,
  totalPages,
  onPageChange
}: DataGridProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const columns = useMemo(() => {
    if (!data?.columns) return []
    return data.columns.map(colName => {
      const schemaCol = schema.columns.find(c => c.name === colName)
      return {
        name: colName,
        type: schemaCol?.type || 'text',
        isPrimaryKey: schemaCol?.isPrimaryKey || false,
        isForeignKey: schemaCol?.isForeignKey || false,
        nullable: schemaCol?.nullable ?? true
      }
    })
  }, [data?.columns, schema.columns])

  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">NULL</span>
    }

    switch (type) {
      case 'boolean':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            value
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {value ? 'true' : 'false'}
          </span>
        )

      case 'timestamp':
      case 'date':
        try {
          const date = new Date(value)
          return (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              <span className="text-sm font-mono">
                {date.toLocaleDateString()} {date.toLocaleTimeString()}
              </span>
            </div>
          )
        } catch {
          return <span className="font-mono text-sm">{String(value)}</span>
        }

      case 'json':
      case 'jsonb':
        try {
          const parsed = typeof value === 'string' ? JSON.parse(value) : value
          return (
            <details className="cursor-pointer">
              <summary className="text-indigo-600 hover:text-indigo-800">
                {Array.isArray(parsed) ? `Array(${parsed.length})` : 'Object'}
              </summary>
              <pre className="mt-1 text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-32">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </details>
          )
        } catch {
          return <span className="font-mono text-sm text-gray-600">{String(value)}</span>
        }

      case 'text':
        const stringValue = String(value)
        if (stringValue.length > 50) {
          return (
            <span title={stringValue} className="cursor-help">
              {stringValue.substring(0, 50)}...
            </span>
          )
        }
        return <span>{stringValue}</span>

      default:
        return <span className="font-mono text-sm">{String(value)}</span>
    }
  }

  const getColumnIcon = (column: typeof columns[0]) => {
    if (column.isPrimaryKey) {
      return <Key className="w-3 h-3 text-yellow-600" />
    } else if (column.isForeignKey) {
      return <Link className="w-3 h-3 text-blue-600" />
    }
    return null
  }

  const getColumnTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'serial':
      case 'integer':
      case 'bigint':
        return 'bg-blue-50 text-blue-700'
      case 'text':
      case 'varchar':
      case 'char':
        return 'bg-green-50 text-green-700'
      case 'boolean':
        return 'bg-purple-50 text-purple-700'
      case 'timestamp':
      case 'date':
      case 'time':
        return 'bg-orange-50 text-orange-700'
      case 'json':
      case 'jsonb':
        return 'bg-indigo-50 text-indigo-700'
      case 'float':
      case 'decimal':
      case 'numeric':
        return 'bg-teal-50 text-teal-700'
      case 'enum':
        return 'bg-pink-50 text-pink-700'
      default:
        return 'bg-gray-50 text-gray-700'
    }
  }

  const handleRowSelect = (index: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedRows.size === data?.rows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(data?.rows.map((_, index) => index) || []))
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading data...</p>
        </div>
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <MoreHorizontal className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No data found</h3>
          <p className="text-gray-500">This table is empty or no results match your search.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full bg-white">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-12 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.rows.length && data.rows.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              {columns.map((column) => (
                <th
                  key={column.name}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center gap-2">
                    {getColumnIcon(column)}
                    <span>{column.name}</span>
                    {!column.nullable && (
                      <span className="text-red-500">*</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getColumnTypeColor(column.type)}`}>
                      {column.type}
                    </span>
                  </div>
                </th>
              ))}
              <th className="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.rows.map((row, index) => (
              <tr
                key={index}
                className={`hover:bg-gray-50 transition-colors ${
                  selectedRows.has(index) ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(index)}
                    onChange={() => handleRowSelect(index)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                {columns.map((column) => (
                  <td key={column.name} className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                    {formatValue(row[column.name], column.type)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(row)}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                      title="Edit record"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(row)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <span className="text-sm text-gray-500">
              ({data.totalCount} total rows)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      pageNum === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}