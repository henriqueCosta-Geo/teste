'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Eye, Database, FileText, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { collectionsAPI } from '@/lib/api'
import type { Collection } from '@/lib/types'
import RoleGuard from '@/components/auth/RoleGuard'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{type: 'success' | 'error', message: string} | null>(null)

  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      const data = await collectionsAPI.list()
      setCollections(data)
    } catch (error) {
      console.error('Erro ao carregar coleções:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Tem certeza que deseja deletar a coleção "${name}"?`)) {
      try {
        await collectionsAPI.delete(id)
        await loadCollections()
      } catch (error) {
        alert('Erro ao deletar coleção')
      }
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    
    try {
      const response = await fetch('/api/proxy/sync/collections', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.error) {
        setSyncResult({
          type: 'error',
          message: result.error
        })
      } else {
        setSyncResult({
          type: 'success',
          message: `Sincronizado ${result.synced_collections} coleções do Qdrant. ${result.skipped_collections} já existiam.`
        })
        // Recarregar coleções após sincronização
        await loadCollections()
      }
      
      // Limpar resultado após 5 segundos
      setTimeout(() => setSyncResult(null), 5000)
      
    } catch (error: any) {
      setSyncResult({
        type: 'error',
        message: error.message || 'Erro ao sincronizar coleções'
      })
      setTimeout(() => setSyncResult(null), 5000)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>Carregando coleções...</span>
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={['SUPER_USER']} redirectTo="/">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Coleções</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gerencie suas bases de conhecimento vetoriais</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-outline flex items-center gap-2"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar do Qdrant'}
          </button>
          <Link href="/collections/create" className="btn-primary">
            <Plus size={16} />
            Nova Coleção
          </Link>
        </div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          syncResult.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {syncResult.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{syncResult.message}</span>
        </div>
      )}

      {/* Collections Grid */}
      {collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <div key={collection.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Database size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{collection.name}</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Criada em {new Date(collection.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(collection.id, collection.name)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {collection.description || 'Sem descrição'}
              </p>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Arquivos:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{collection.files_count}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Chunks:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{(collection.chunks_count || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Dimensões:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{collection.vector_size}D</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Métrica:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{collection.distance_metric}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/collections/${collection.id}`}
                  className="btn-primary flex-1 justify-center text-sm"
                >
                  <Eye size={14} />
                  Ver Detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Database size={64} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Nenhuma coleção encontrada
          </h3>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            Crie sua primeira coleção para começar a armazenar documentos
          </p>
          <Link href="/collections/create" className="btn-primary">
            <Plus size={16} />
            Criar primeira coleção
          </Link>
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <FileText className="text-blue-600 dark:text-blue-400 mt-1" size={20} />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Como funcionam as coleções?
            </h4>
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              As coleções armazenam seus documentos como vetores no Qdrant. 
              Você pode fazer upload de arquivos PDF, TXT, DOCX e Markdown, 
              que serão processados em chunks e convertidos em embeddings para busca semântica.
            </p>
          </div>
        </div>
      </div>
      </div>
    </RoleGuard>
  )
}