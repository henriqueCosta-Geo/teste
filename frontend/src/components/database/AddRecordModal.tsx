'use client'

import { useState } from 'react'
import { X, Plus, Key, Link, AlertCircle } from 'lucide-react'
import { TableSchema } from './DatabaseViewer'

interface AddRecordModalProps {
  schema: TableSchema
  onClose: () => void
  onSave: () => void
}

export function AddRecordModal({ schema, onClose, onSave }: AddRecordModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const handleInputChange = (columnName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [columnName]: value
    }))

    // Clear error when user starts typing
    if (errors[columnName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[columnName]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    schema.columns.forEach(column => {
      if (!column.nullable && !column.isPrimaryKey && !column.default) {
        const value = formData[column.name]
        if (value === undefined || value === null || value === '') {
          newErrors[column.name] = 'This field is required'
        }
      }

      // Type-specific validations
      if (formData[column.name] !== undefined && formData[column.name] !== '') {
        const value = formData[column.name]

        switch (column.type) {
          case 'integer':
          case 'bigint':
          case 'serial':
            if (isNaN(Number(value))) {
              newErrors[column.name] = 'Must be a valid number'
            }
            break

          case 'float':
          case 'decimal':
          case 'numeric':
            if (isNaN(Number(value))) {
              newErrors[column.name] = 'Must be a valid decimal number'
            }
            break

          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              newErrors[column.name] = 'Must be true or false'
            }
            break

          case 'json':
          case 'jsonb':
            if (typeof value === 'string') {
              try {
                JSON.parse(value)
              } catch {
                newErrors[column.name] = 'Must be valid JSON'
              }
            }
            break

          case 'timestamp':
          case 'date':
            if (value && isNaN(Date.parse(value))) {
              newErrors[column.name] = 'Must be a valid date'
            }
            break
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // Prepare data for submission
      const submitData: Record<string, any> = {}

      schema.columns.forEach(column => {
        const value = formData[column.name]

        // Skip primary keys and auto-generated fields
        if (column.isPrimaryKey && column.type === 'serial') {
          return
        }

        if (value !== undefined && value !== '') {
          switch (column.type) {
            case 'integer':
            case 'bigint':
            case 'serial':
              submitData[column.name] = parseInt(value)
              break

            case 'float':
            case 'decimal':
            case 'numeric':
              submitData[column.name] = parseFloat(value)
              break

            case 'boolean':
              submitData[column.name] = value === true || value === 'true'
              break

            case 'json':
            case 'jsonb':
              submitData[column.name] = typeof value === 'string' ? JSON.parse(value) : value
              break

            case 'timestamp':
            case 'date':
              submitData[column.name] = new Date(value).toISOString()
              break

            default:
              submitData[column.name] = value
          }
        } else if (column.nullable) {
          submitData[column.name] = null
        }
      })

      const response = await fetch(`/api/database/${schema.name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create record')
      }

      onSave()
    } catch (error) {
      console.error('Error creating record:', error)
      setErrors({
        _form: error instanceof Error ? error.message : 'Failed to create record'
      })
    } finally {
      setLoading(false)
    }
  }

  const renderInput = (column: TableSchema['columns'][0]) => {
    const value = formData[column.name] || ''
    const hasError = !!errors[column.name]

    const baseInputClass = `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
      hasError ? 'border-red-300 bg-red-50' : 'border-gray-300'
    }`

    switch (column.type) {
      case 'boolean':
        return (
          <select
            value={value.toString()}
            onChange={(e) => handleInputChange(column.name, e.target.value === 'true')}
            className={baseInputClass}
          >
            <option value="">Select...</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        )

      case 'json':
      case 'jsonb':
        return (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            placeholder='{"key": "value"} or []'
            rows={4}
            className={baseInputClass}
          />
        )

      case 'text':
        if (column.name.includes('description') || column.name.includes('instructions')) {
          return (
            <textarea
              value={value}
              onChange={(e) => handleInputChange(column.name, e.target.value)}
              rows={3}
              className={baseInputClass}
            />
          )
        }
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            className={baseInputClass}
          />
        )

      case 'integer':
      case 'bigint':
      case 'serial':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            className={baseInputClass}
          />
        )

      case 'float':
      case 'decimal':
      case 'numeric':
        return (
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            className={baseInputClass}
          />
        )

      case 'timestamp':
      case 'date':
        return (
          <input
            type="datetime-local"
            value={value ? new Date(value).toISOString().slice(0, 16) : ''}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            className={baseInputClass}
          />
        )

      case 'enum':
        // For enum types, we'd ideally get the enum values from the schema
        // For now, we'll render a text input
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            placeholder="Enter enum value"
            className={baseInputClass}
          />
        )

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(column.name, e.target.value)}
            className={baseInputClass}
          />
        )
    }
  }

  const getColumnIcon = (column: TableSchema['columns'][0]) => {
    if (column.isPrimaryKey) {
      return <Key className="w-4 h-4 text-yellow-600" />
    } else if (column.isForeignKey) {
      return <Link className="w-4 h-4 text-blue-600" />
    }
    return null
  }

  // Filter out auto-generated primary keys from the form
  const editableColumns = schema.columns.filter(column =>
    !(column.isPrimaryKey && column.type === 'serial')
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Add new record to {schema.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-80px)]">
          <div className="flex-1 overflow-y-auto p-6">
            {errors._form && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-800">{errors._form}</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {editableColumns.map((column) => (
                <div key={column.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      {getColumnIcon(column)}
                      <span>{column.name}</span>
                      {!column.nullable && !column.default && (
                        <span className="text-red-500">*</span>
                      )}
                      <span className="text-xs text-gray-500">
                        ({column.type})
                      </span>
                    </div>
                  </label>

                  {renderInput(column)}

                  {errors[column.name] && (
                    <p className="mt-1 text-sm text-red-600">{errors[column.name]}</p>
                  )}

                  {column.default && (
                    <p className="mt-1 text-xs text-gray-500">
                      Default: {String(column.default)}
                    </p>
                  )}

                  {column.isForeignKey && column.references && (
                    <p className="mt-1 text-xs text-blue-600">
                      References: {column.references}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Record
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}