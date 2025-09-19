'use client'

import { Table, ChevronRight, Key, Link } from 'lucide-react'
import { TableSchema } from './DatabaseViewer'

interface TableSelectorProps {
  tables: TableSchema[]
  selectedTable: TableSchema | null
  onTableSelect: (table: TableSchema) => void
}

export function TableSelector({ tables, selectedTable, onTableSelect }: TableSelectorProps) {
  const getTableIcon = (tableName: string) => {
    if (tableName.includes('user') || tableName.includes('customer')) {
      return '👥'
    } else if (tableName.includes('agent') || tableName.includes('chat')) {
      return '🤖'
    } else if (tableName.includes('collection') || tableName.includes('file')) {
      return '📁'
    } else if (tableName.includes('metric') || tableName.includes('usage')) {
      return '📊'
    } else if (tableName.includes('session') || tableName.includes('auth')) {
      return '🔐'
    }
    return '📋'
  }

  const getColumnIcon = (column: TableSchema['columns'][0]) => {
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
        return 'text-blue-600'
      case 'text':
      case 'varchar':
      case 'char':
        return 'text-green-600'
      case 'boolean':
        return 'text-purple-600'
      case 'timestamp':
      case 'date':
      case 'time':
        return 'text-orange-600'
      case 'json':
      case 'jsonb':
        return 'text-indigo-600'
      case 'float':
      case 'decimal':
      case 'numeric':
        return 'text-teal-600'
      case 'enum':
        return 'text-pink-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-1">
        {tables.map((table) => {
          const isSelected = selectedTable?.name === table.name

          return (
            <div key={table.name} className="relative">
              <button
                onClick={() => onTableSelect(table)}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                  isSelected
                    ? 'bg-green-50 border border-green-200 shadow-sm'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getTableIcon(table.name)}</span>
                    <div>
                      <div className={`font-medium ${
                        isSelected ? 'text-green-900' : 'text-gray-900'
                      }`}>
                        {table.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {table.columns.length} columns
                      </div>
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    isSelected ? 'text-green-600 rotate-90' : 'text-gray-400 group-hover:text-gray-600'
                  }`} />
                </div>
              </button>

              {/* Expanded table schema */}
              {isSelected && (
                <div className="mt-2 ml-8 space-y-1 border-l-2 border-green-200 pl-3">
                  {table.columns.map((column) => (
                    <div
                      key={column.name}
                      className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-green-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getColumnIcon(column)}
                        <span className="font-medium text-gray-900 truncate">
                          {column.name}
                        </span>
                        {!column.nullable && (
                          <span className="text-red-500 text-xs">*</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`font-mono ${getColumnTypeColor(column.type)}`}>
                          {column.type}
                        </span>
                        {column.default && (
                          <span className="text-gray-400 text-xs">
                            = {String(column.default)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Foreign key references */}
                  {table.columns.some(col => col.isForeignKey) && (
                    <div className="mt-2 pt-2 border-t border-green-100">
                      <div className="text-xs font-medium text-gray-600 mb-1">References:</div>
                      {table.columns
                        .filter(col => col.isForeignKey)
                        .map(col => (
                          <div key={col.name} className="text-xs text-blue-600 pl-2">
                            {col.name} → {col.references}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}