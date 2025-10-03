'use client'

import { useState, useEffect } from 'react'
import { Database, Table, Plus, Search, Filter, Edit, Trash2, RefreshCw, Terminal } from 'lucide-react'
import { TableSelector } from './TableSelector'
import { DataGrid } from './DataGrid'
import { AddRecordModal } from './AddRecordModal'
import { EditRecordModal } from './EditRecordModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { DatabaseStatus } from './DatabaseStatus'
import { SQLQueryPanel } from './SQLQueryPanel'

interface DatabaseViewerProps {
  className?: string
}

export interface TableSchema {
  name: string
  columns: Array<{
    name: string
    type: string
    nullable: boolean
    default?: any
    isPrimaryKey?: boolean
    isForeignKey?: boolean
    references?: string
  }>
}

export interface TableData {
  columns: string[]
  rows: Record<string, any>[]
  totalCount: number
}

// Tables will be loaded dynamically from the API

export function DatabaseViewer({ className = '' }: DatabaseViewerProps) {
  const [tables, setTables] = useState<TableSchema[]>([])
  const [selectedTable, setSelectedTable] = useState<TableSchema | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tablesLoading, setTablesLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [activeTab, setActiveTab] = useState<'tables' | 'query'>('tables')

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<Record<string, any> | null>(null)

  // Load tables on component mount
  useEffect(() => {
    loadTables()
  }, [])

  const loadTables = async () => {
    setTablesLoading(true)
    try {
      const response = await fetch('/api/database/tables')
      if (!response.ok) throw new Error('Failed to fetch tables')

      const data = await response.json()
      setTables(data.tables || [])
    } catch (error) {
      console.error('Error loading tables:', error)
      setTables([])
    } finally {
      setTablesLoading(false)
    }
  }

  const loadTableData = async (tableName: string, searchQuery = '', page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery })
      })

      const response = await fetch(`/api/database/${tableName}?${params}`)
      if (!response.ok) throw new Error('Failed to fetch data')

      const data = await response.json()
      setTableData(data)
    } catch (error) {
      console.error('Error loading table data:', error)
      setTableData({ columns: [], rows: [], totalCount: 0 })
    } finally {
      setLoading(false)
    }
  }

  const handleTableSelect = (table: TableSchema) => {
    setSelectedTable(table)
    setSearchQuery('')
    setPage(1)
    loadTableData(table.name)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
    if (selectedTable) {
      loadTableData(selectedTable.name, query, 1)
    }
  }

  const handleRefresh = () => {
    if (selectedTable) {
      loadTableData(selectedTable.name, searchQuery, page)
    }
  }

  const handleAddRecord = () => {
    setShowAddModal(true)
  }

  const handleEditRecord = (record: Record<string, any>) => {
    setSelectedRecord(record)
    setShowEditModal(true)
  }

  const handleDeleteRecord = (record: Record<string, any>) => {
    setSelectedRecord(record)
    setShowDeleteModal(true)
  }

  const handleRecordSaved = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setSelectedRecord(null)
    handleRefresh()
  }

  const handleRecordDeleted = () => {
    setShowDeleteModal(false)
    setSelectedRecord(null)
    handleRefresh()
  }

  const totalPages = tableData ? Math.ceil(tableData.totalCount / limit) : 0

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="flex h-screen">
        {/* Sidebar - Table Selector */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-green-600" />
              <h1 className="text-lg font-semibold text-gray-900">Database</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setActiveTab('tables')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'tables'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Table className="w-4 h-4" />
                Tabelas
              </button>
              <button
                onClick={() => setActiveTab('query')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'query'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Terminal className="w-4 h-4" />
                SQL
              </button>
            </div>

            <div className="text-sm text-gray-500">
              {activeTab === 'tables' && (tablesLoading ? 'Loading...' : `Tables (${tables.length})`)}
              {activeTab === 'query' && 'Execute queries personalizadas'}
            </div>
          </div>

          {/* Database Status */}
          <div className="p-4 border-b border-gray-200">
            <DatabaseStatus />
          </div>

          {activeTab === 'tables' && (
            tablesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <TableSelector
                tables={tables}
                selectedTable={selectedTable}
                onTableSelect={handleTableSelect}
              />
            )
          )}

          {activeTab === 'query' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <h3 className="text-sm font-medium text-blue-900 mb-1">💡 Dica</h3>
                  <p className="text-xs text-blue-700">
                    Use Ctrl+Enter para executar a query rapidamente
                  </p>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <h3 className="text-sm font-medium text-yellow-900 mb-1">⚠️ Segurança</h3>
                  <p className="text-xs text-yellow-700">
                    Apenas queries SELECT são permitidas por segurança
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'query' ? (
            <SQLQueryPanel />
          ) : selectedTable ? (
            <>
              {/* Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-gray-600" />
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedTable.name}
                    </h2>
                    <span className="text-sm text-gray-500">
                      ({tableData?.totalCount || 0} rows)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-md transition-colors ${
                        showFilters
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleAddRecord}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search in table..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Data Grid */}
              <div className="flex-1 overflow-hidden">
                <DataGrid
                  schema={selectedTable}
                  data={tableData}
                  loading={loading}
                  onEdit={handleEditRecord}
                  onDelete={handleDeleteRecord}
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a table
                </h3>
                <p className="text-gray-500">
                  Choose a table from the sidebar to view and edit data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && selectedTable && (
        <AddRecordModal
          schema={selectedTable}
          onClose={() => setShowAddModal(false)}
          onSave={handleRecordSaved}
        />
      )}

      {showEditModal && selectedTable && selectedRecord && (
        <EditRecordModal
          schema={selectedTable}
          record={selectedRecord}
          onClose={() => setShowEditModal(false)}
          onSave={handleRecordSaved}
        />
      )}

      {showDeleteModal && selectedTable && selectedRecord && (
        <DeleteConfirmModal
          tableName={selectedTable.name}
          record={selectedRecord}
          onClose={() => setShowDeleteModal(false)}
          onDelete={handleRecordDeleted}
        />
      )}
    </div>
  )
}