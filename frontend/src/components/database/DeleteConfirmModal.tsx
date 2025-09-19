'use client'

import { useState } from 'react'
import { X, Trash2, AlertTriangle } from 'lucide-react'

interface DeleteConfirmModalProps {
  tableName: string
  record: Record<string, any>
  onClose: () => void
  onDelete: () => void
}

export function DeleteConfirmModal({ tableName, record, onClose, onDelete }: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find primary key and its value for display
  const getPrimaryKeyInfo = () => {
    // Common primary key names
    const pkCandidates = ['id', 'pk', `${tableName}_id`]

    for (const candidate of pkCandidates) {
      if (record[candidate] !== undefined) {
        return { key: candidate, value: record[candidate] }
      }
    }

    // If no common PK found, use the first non-null field
    const firstField = Object.entries(record).find(([_, value]) => value !== null && value !== undefined)
    return firstField ? { key: firstField[0], value: firstField[1] } : { key: 'record', value: 'Unknown' }
  }

  const { key: pkKey, value: pkValue } = getPrimaryKeyInfo()

  // Get a few key fields to display as preview
  const getRecordPreview = () => {
    const previewFields = ['name', 'title', 'email', 'username', 'description']
    const preview: Array<{ key: string; value: any }> = []

    // Add primary key first
    if (pkKey && pkValue !== undefined) {
      preview.push({ key: pkKey, value: pkValue })
    }

    // Add other meaningful fields
    previewFields.forEach(field => {
      if (record[field] !== undefined && record[field] !== null && field !== pkKey) {
        preview.push({ key: field, value: record[field] })
      }
    })

    // If we don't have enough fields, add more
    if (preview.length < 3) {
      Object.entries(record).forEach(([key, value]) => {
        if (preview.length >= 5) return
        if (value !== null && value !== undefined && !preview.some(p => p.key === key)) {
          preview.push({ key, value })
        }
      })
    }

    return preview.slice(0, 5)
  }

  const recordPreview = getRecordPreview()

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/database/${tableName}/${pkValue}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete record')
      }

      onDelete()
    } catch (error) {
      console.error('Error deleting record:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete record')
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">NULL</span>
    }

    if (typeof value === 'boolean') {
      return <span className={`px-2 py-1 rounded text-xs ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {value ? 'true' : 'false'}
      </span>
    }

    if (typeof value === 'object') {
      return <span className="text-indigo-600 font-mono text-sm">Object</span>
    }

    const stringValue = String(value)
    if (stringValue.length > 50) {
      return <span title={stringValue}>{stringValue.substring(0, 50)}...</span>
    }

    return <span>{stringValue}</span>
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Delete Record
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-900 mb-2">
              Are you sure you want to delete this record from <span className="font-mono font-medium">{tableName}</span>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
            </p>
          </div>

          {/* Record Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Record details:</h4>
            <div className="space-y-2">
              {recordPreview.map(({ key, value }) => (
                <div key={key} className="flex justify-between items-start text-sm">
                  <span className="font-medium text-gray-600 mr-2">{key}:</span>
                  <span className="text-gray-900 text-right flex-1 min-w-0">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Record
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}