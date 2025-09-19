'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, AlertCircle, Settings, Save, Database, Plus, Trash2 } from 'lucide-react'
import { agentsAPI, collectionsAPI } from '../../../lib/api'
import type { Agent, Collection } from '../../../lib/types'

export default function AgentConfigPage() {
  const router = useRouter()
  const params = useParams()
  const agentId = parseInt(params.id as string)

  const [agent, setAgent] = useState<Agent | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedCollections, setSelectedCollections] = useState<number[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    instructions: '',
    tools_config: [] as string[],
    is_active: true
  })

  useEffect(() => {
    if (agentId) {
      loadAgent()
      loadCollections()
    }
  }, [agentId])

  const loadAgent = async () => {
    try {
      const data = await agentsAPI.get(agentId)
      setAgent(data)
      setFormData({
        name: data.name || '',
        description: data.description || '',
        role: data.role || '',
        model: data.model || 'gpt-3.5-turbo',
        temperature: data.temperature || 0.7,
        instructions: data.instructions || '',
        tools_config: data.tools_config || ['rag'],
        is_active: data.is_active !== false
      })
      setSelectedCollections(data.collections?.map(c => c.id) || [])
    } catch (error) {
      console.error('Erro ao carregar agente:', error)
      setError('Erro ao carregar agente')
    } finally {
      setLoading(false)
    }
  }

  const loadCollections = async () => {
    try {
      const data = await collectionsAPI.list()
      setCollections(data)
    } catch (error) {
      console.error('Erro ao carregar coleções:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setSaving(true)
    setError('')

    try {
      const updateFormData = new FormData()
      updateFormData.append('name', formData.name.trim())
      updateFormData.append('description', formData.description.trim())
      updateFormData.append('role', formData.role.trim())
      updateFormData.append('model', formData.model)
      updateFormData.append('temperature', formData.temperature.toString())
      updateFormData.append('instructions', formData.instructions)
      updateFormData.append('tools_config', JSON.stringify(formData.tools_config))
      updateFormData.append('is_active', formData.is_active.toString())

      await agentsAPI.update(agentId, updateFormData)

      // Atualizar coleções associadas
      const currentCollections = agent?.collections?.map(c => c.id) || []
      const collectionsToAdd = selectedCollections.filter(id => !currentCollections.includes(id))
      const collectionsToRemove = currentCollections.filter(id => !selectedCollections.includes(id))

      // Remover coleções
      for (const collectionId of collectionsToRemove) {
        try {
          await agentsAPI.removeCollection(agentId, collectionId)
        } catch (error) {
          console.warn('Erro ao remover coleção:', error)
        }
      }

      // Adicionar coleções
      for (const collectionId of collectionsToAdd) {
        try {
          await agentsAPI.assignCollection(agentId, {
            collection_id: collectionId,
            access_level: 'read',
            priority: 1
          })
        } catch (error) {
          console.warn('Erro ao adicionar coleção:', error)
        }
      }

      router.push('/agents')
    } catch (error: any) {
      setError(error.message || 'Erro ao atualizar agente')
    } finally {
      setSaving(false)
    }
  }

  const toggleCollection = (collectionId: number) => {
    setSelectedCollections(prev => 
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    )
  }

  const toggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      tools_config: prev.tools_config.includes(tool)
        ? prev.tools_config.filter(t => t !== tool)
        : [...prev.tools_config, tool]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3 text-gray-600">Carregando configurações...</span>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <AlertCircle size={64} className="mx-auto mb-4 text-red-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Agente não encontrado
        </h3>
        <p className="text-gray-600 mb-6">
          O agente solicitado não existe ou foi removido.
        </p>
        <Link href="/agents" className="btn-primary">
          <ArrowLeft size={16} />
          Voltar aos agentes
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/agents"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${agent.is_active ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Bot size={20} className={agent.is_active ? 'text-blue-600' : 'text-gray-400'} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configurações do Agente</h1>
            <p className="text-gray-600">{agent.name}</p>
          </div>
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

          {/* Status */}
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <span className="font-medium text-gray-900">Status do Agente</span>
              <p className="text-sm text-gray-600">Ativar ou desativar o agente</p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-900">
                {formData.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </label>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Informações Básicas</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Papel/Função
                </label>
                <input
                  type="text"
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Model Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Configuração do Modelo</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo
                </label>
                <select
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                </select>
              </div>

              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature ({formData.temperature})
                </label>
                <input
                  type="range"
                  id="temperature"
                  value={formData.temperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  min="0"
                  max="2"
                  step="0.1"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Mais focado</span>
                  <span>Mais criativo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
              Instruções do Sistema
            </label>
            <textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Defina como o agente deve se comportar e responder..."
            />
          </div>

          {/* Tools */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ferramentas Habilitadas
            </label>
            <div className="space-y-2">
              {['rag', 'web_search', 'calculator'].map(tool => (
                <label key={tool} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.tools_config.includes(tool)}
                    onChange={() => toggleTool(tool)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {tool.replace('_', ' ')} {tool === 'rag' && '(Recomendado)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Collections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bases de Conhecimento (Coleções)
            </label>
            
            {collections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {collections.map(collection => (
                  <label
                    key={collection.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCollections.includes(collection.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(collection.id)}
                      onChange={() => toggleCollection(collection.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{collection.name}</div>
                      <div className="text-sm text-gray-600">
                        {collection.files_count} arquivos • {collection.chunks_count} chunks
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                <Database size={48} className="mx-auto mb-3 text-gray-300" />
                <p>Nenhuma coleção disponível</p>
                <Link href="/collections/create" className="btn-primary mt-3 inline-flex">
                  <Plus size={16} />
                  Criar primeira coleção
                </Link>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t">
            <Link
              href="/agents"
              className="btn-outline flex-1 justify-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 justify-center"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save size={16} />
                  Salvar Alterações
                </div>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="card mt-6 border-red-200">
        <h3 className="text-lg font-medium text-red-900 mb-4">Zona de Perigo</h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-red-800">Deletar este agente permanentemente</p>
            <p className="text-sm text-red-600">Esta ação não pode ser desfeita.</p>
          </div>
          <button
            onClick={() => {
              if (window.confirm(`Tem certeza que deseja deletar o agente "${agent.name}"?`)) {
                agentsAPI.delete(agentId).then(() => {
                  router.push('/agents')
                }).catch(() => {
                  setError('Erro ao deletar agente')
                })
              }
            }}
            className="btn-danger"
          >
            <Trash2 size={16} />
            Deletar Agente
          </button>
        </div>
      </div>
    </div>
  )
}