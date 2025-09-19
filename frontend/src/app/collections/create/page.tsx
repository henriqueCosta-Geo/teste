'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Database, Upload, AlertCircle } from 'lucide-react'
import { collectionsAPI } from '@/lib/api'

export default function CreateCollectionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    vector_size: 384,
    distance_metric: 'Cosine' as 'Cosine' | 'Dot' | 'Euclidean'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setLoading(true)
    setError('')

    try {
      await collectionsAPI.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
        vector_size: formData.vector_size,
        distance_metric: formData.distance_metric
      })

      router.push('/collections')
    } catch (error: any) {
      setError(error.message || 'Erro ao criar coleção')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/collections"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Coleção</h1>
          <p className="text-gray-600">Crie uma nova coleção vetorial</p>
        </div>
      </div>

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nome *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: documentos-empresa"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use apenas letras, números, hífens e underscores
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o propósito desta coleção..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vector_size" className="block text-sm font-medium text-gray-700 mb-2">
                Dimensões do Vetor
              </label>
              <select
                id="vector_size"
                value={formData.vector_size}
                onChange={(e) => setFormData(prev => ({ ...prev, vector_size: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={384}>384 (sentence-transformers)</option>
                <option value={768}>768 (BERT-base)</option>
                <option value={1024}>1024 (BERT-large)</option>
                <option value={1536}>1536 (OpenAI ada-002)</option>
              </select>
            </div>

            <div>
              <label htmlFor="distance_metric" className="block text-sm font-medium text-gray-700 mb-2">
                Métrica de Distância
              </label>
              <select
                id="distance_metric"
                value={formData.distance_metric}
                onChange={(e) => setFormData(prev => ({ ...prev, distance_metric: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Cosine">Cosine (recomendado)</option>
                <option value="Dot">Dot Product</option>
                <option value="Euclidean">Euclidean</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Database className="text-blue-600 mt-0.5" size={16} />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">
                  Sobre as Configurações
                </h4>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• <strong>Dimensões:</strong> Deve corresponder ao modelo de embedding usado</li>
                  <li>• <strong>Cosine:</strong> Melhor para textos e embeddings normalizados</li>
                  <li>• <strong>Dot Product:</strong> Rápido, mas requer vetores normalizados</li>
                  <li>• <strong>Euclidean:</strong> Distância geométrica tradicional</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <Link
              href="/collections"
              className="btn-outline flex-1 justify-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Criando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Database size={16} />
                  Criar Coleção
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}