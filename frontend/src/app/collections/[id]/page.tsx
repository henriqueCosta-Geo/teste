'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Database, FileText, Upload, Trash2, Download, Search, Settings, AlertCircle, CheckCircle } from 'lucide-react'
import { collectionsAPI, filesAPI } from '@/lib/api'
import type { Collection } from '@/lib/types'

export default function CollectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [collection, setCollection] = useState<Collection | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  useEffect(() => {
    loadCollection()
    loadFiles()
  }, [params.id])

  const loadCollection = async () => {
    try {
      if (!params.id) {
        throw new Error('ID da coleção não fornecido')
      }
      const collectionId = parseInt(params.id as string)
      if (isNaN(collectionId)) {
        throw new Error('ID da coleção inválido')
      }
      const data = await collectionsAPI.get(collectionId)
      setCollection(data)
    } catch (error) {
      console.error('Erro ao carregar coleção:', error)
      router.push('/collections')
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async () => {
    try {
      if (!params.id) {
        setFiles([])
        return
      }
      const collectionId = parseInt(params.id as string)
      if (isNaN(collectionId)) {
        setFiles([])
        return
      }
      const data = await collectionsAPI.getFiles(collectionId)
      setFiles(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error)
      setFiles([])
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (selectedFiles.length === 0) return

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const collectionId = parseInt(params.id as string)
      if (isNaN(collectionId)) {
        throw new Error('ID da coleção inválido')
      }

      for (const file of selectedFiles) {
        await collectionsAPI.uploadFile(collectionId, file)
      }

      setUploadSuccess(`${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`)
      loadCollection()
      loadFiles()
      
      // Clear success message after 5 seconds
      setTimeout(() => setUploadSuccess(''), 5000)
    } catch (error: any) {
      setUploadError(error.message || 'Erro ao fazer upload dos arquivos')
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (window.confirm(`Tem certeza que deseja deletar o arquivo "${fileName}"?`)) {
      try {
        const fileIdNumber = parseInt(fileId)
        if (isNaN(fileIdNumber)) {
          throw new Error('ID do arquivo inválido')
        }
        
        await filesAPI.delete(fileIdNumber)
        loadCollection()
        loadFiles()
      } catch (error: any) {
        alert(error.message || 'Erro ao deletar arquivo')
      }
    }
  }

  const handleDeleteCollection = async () => {
    if (window.confirm(`Tem certeza que deseja deletar a coleção "${collection?.name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await collectionsAPI.delete(parseInt(params.id as string))
        router.push('/collections')
      } catch (error: any) {
        alert(error.message || 'Erro ao deletar coleção')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3 text-gray-600">Carregando coleção...</span>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="text-center py-12">
        <Database size={64} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Coleção não encontrada
        </h3>
        <Link href="/collections" className="btn-primary">
          Voltar às Coleções
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/collections"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{collection.name}</h1>
            <p className="text-gray-600">
              {collection.description || 'Coleção vetorial Qdrant'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteCollection}
            className="btn-outline text-red-600 border-red-300 hover:bg-red-50"
          >
            <Trash2 size={16} />
            Deletar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Arquivos</p>
              <p className="text-xl font-bold text-gray-900">{collection.files_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Chunks</p>
              <p className="text-xl font-bold text-gray-900">{(collection.chunks_count || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Dimensões</p>
              <p className="text-xl font-bold text-gray-900">{collection.vector_size || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Search className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Distância</p>
              <p className="text-xl font-bold text-gray-900">{collection.distance_metric || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Upload de Arquivos</h2>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle size={16} />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle size={16} />
            <span>{uploadSuccess}</span>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  Clique para selecionar arquivos ou arraste aqui
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  multiple
                  accept=".pdf,.txt,.doc,.docx,.md"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">
                PDF, TXT, DOC, DOCX, MD até 10MB cada
              </p>
            </div>
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="loading"></div>
                <span className="text-sm text-gray-600">Fazendo upload...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Arquivos ({files.length})</h2>
        </div>

        {files.length > 0 ? (
          <div className="space-y-3">
            {files.map((file, index) => (
              <div key={file.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{file.name || file.filename}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamanho desconhecido'}</span>
                      {file.chunks_count && <span>{file.chunks_count} chunks</span>}
                      {file.uploaded_at && <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.status && (
                    <span className={`badge ${file.status === 'processed' ? 'badge-green' : 'badge-yellow'}`}>
                      {file.status === 'processed' ? 'Processado' : 'Processando'}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteFile(file.id, file.name || file.filename)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Nenhum arquivo encontrado</p>
            <p className="text-sm">Faça upload de arquivos para começar</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Database className="text-blue-600 mt-1" size={20} />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">
              Sobre esta coleção
            </h4>
            <div className="text-blue-800 text-sm space-y-1">
              <p>• <strong>ID:</strong> {collection.id}</p>
              <p>• <strong>Dimensões do vetor:</strong> {collection.vector_size}</p>
              <p>• <strong>Métrica de distância:</strong> {collection.distance_metric}</p>
              <p>• <strong>Status:</strong> {collection.files_count > 0 ? 'Ativa' : 'Vazia'}</p>
              <p>• Os arquivos são processados automaticamente em chunks para busca semântica</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}