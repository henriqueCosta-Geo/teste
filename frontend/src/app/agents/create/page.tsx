'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, AlertCircle, Database, Plus, X } from 'lucide-react'
import { agentsAPI, collectionsAPI } from '@/lib/api'
import type { Collection } from '@/lib/types'

export default function CreateAgentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [error, setError] = useState('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollections, setSelectedCollections] = useState<number[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1000,
    system_prompt: 'Você é um assistente IA especializado em responder perguntas sobre documentos. Use as informações fornecidas para dar respostas precisas e úteis.',
    tools_config: ['rag'] as string[]
  })

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
      setLoadingCollections(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Criar agente usando a API
      const result = await agentsAPI.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
        role: formData.role.trim() || 'Assistente',
        model: formData.model,
        temperature: formData.temperature,
        instructions: formData.system_prompt,
        tools_config: formData.tools_config
      })

      // Adicionar coleções se selecionadas
      if (selectedCollections.length > 0 && result.id) {
        for (const collectionId of selectedCollections) {
          try {
            await agentsAPI.assignCollection(result.id, {
              collection_id: collectionId,
              access_level: 'read',
              priority: 1
            })
          } catch (collectionError) {
            console.warn('Erro ao associar coleção:', collectionError)
          }
        }
      }

      router.push('/agents')
    } catch (error: any) {
      setError(error.message || 'Erro ao criar agente')
    } finally {
      setLoading(false)
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Agente</h1>
          <p className="text-gray-600">Crie um novo agente IA com acesso RAG</p>
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
                  placeholder="Ex: Assistente de Documentos"
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
                  placeholder="Ex: Especialista em vendas"
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
                placeholder="Descreva o propósito e especialidade deste agente..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Model Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Configuração do Modelo</h3>
              <div className="text-xs text-gray-500">
                💡 Preços aproximados por 1M tokens
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo IA
                </label>
                <select
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <optgroup label="🚀 GPT-4.1 (Abril 2025) - Mais Recente">
                    <option value="gpt-4.1">GPT-4.1 - Melhor em código (+21.4% vs GPT-4o)</option>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini - 83% mais barato, metade da latência</option>
                    <option value="gpt-4.1-nano">GPT-4.1 Nano - Mais rápido e econômico</option>
                  </optgroup>
                  <optgroup label="⭐ GPT-4 (Recomendados)">
                    <option value="gpt-4o">GPT-4o - Multimodal (texto, imagem, áudio)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini - Ótimo custo-benefício</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo - Alta performance</option>
                    <option value="gpt-4">GPT-4 - Clássico, alta qualidade</option>
                  </optgroup>
                  <optgroup label="💰 Econômicos">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo - Rápido e barato</option>
                    <option value="gpt-3.5-turbo-16k">GPT-3.5 Turbo 16K - Contexto maior</option>
                  </optgroup>
                </select>
                
                {/* Model Info */}
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
                  {formData.model === 'gpt-4.1' && (
                    <div>
                      <div>🎯 <strong>Melhor para:</strong> Codificação, engenharia, documentos longos</div>
                      <div>📊 <strong>Contexto:</strong> 1M tokens • <strong>Preço:</strong> $2/$8 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-4.1-mini' && (
                    <div>
                      <div>⚡ <strong>Melhor para:</strong> Uso geral econômico, chatbots, assistentes</div>
                      <div>📊 <strong>Contexto:</strong> 1M tokens • <strong>Preço:</strong> $0.40/$1.60 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-4.1-nano' && (
                    <div>
                      <div>🏃 <strong>Melhor para:</strong> Classificação, autocompleção, tarefas simples</div>
                      <div>📊 <strong>Contexto:</strong> 1M tokens • <strong>Preço:</strong> $0.10/$0.40 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-4o' && (
                    <div>
                      <div>🎨 <strong>Multimodal:</strong> Texto, imagem, áudio • Tarefas complexas</div>
                      <div>📊 <strong>Contexto:</strong> 128K tokens • <strong>Preço:</strong> $2.50/$10 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-4o-mini' && (
                    <div>
                      <div>💎 <strong>Recomendado:</strong> Excelente custo-benefício, uso geral</div>
                      <div>📊 <strong>Contexto:</strong> 128K tokens • <strong>Preço:</strong> $0.15/$0.60 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-4-turbo' && (
                    <div>
                      <div>🚀 <strong>Alta performance:</strong> Tarefas complexas, análises</div>
                      <div>📊 <strong>Contexto:</strong> 128K tokens • <strong>Preço:</strong> $10/$30 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-4' && (
                    <div>
                      <div>🏆 <strong>Clássico:</strong> Máxima qualidade, tarefas críticas</div>
                      <div>📊 <strong>Contexto:</strong> 8K tokens • <strong>Preço:</strong> $30/$60 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-3.5-turbo' && (
                    <div>
                      <div>💰 <strong>Econômico:</strong> Rápido e barato, chatbots simples</div>
                      <div>📊 <strong>Contexto:</strong> 4K tokens • <strong>Preço:</strong> $0.50/$1.50 (entrada/saída)</div>
                    </div>
                  )}
                  {formData.model === 'gpt-3.5-turbo-16k' && (
                    <div>
                      <div>💰 <strong>Econômico:</strong> Contexto maior, documentos médios</div>
                      <div>📊 <strong>Contexto:</strong> 16K tokens • <strong>Preço:</strong> $1/$2 (entrada/saída)</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
                  Temperature
                </label>
                <input
                  type="number"
                  id="temperature"
                  value={formData.temperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  min="0"
                  max="2"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0 = Determinístico, 1 = Equilibrado, 2 = Criativo
                </p>
              </div>

              <div>
                <label htmlFor="max_tokens" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Tokens de Resposta
                </label>
                <select
                  id="max_tokens"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="500">500 tokens - Respostas curtas</option>
                  <option value="1000">1.000 tokens - Respostas médias</option>
                  <option value="2000">2.000 tokens - Respostas longas</option>
                  <option value="4000">4.000 tokens - Respostas muito longas</option>
                  <option value="8000">8.000 tokens - Análises detalhadas</option>
                  {(formData.model.includes('gpt-4.1') || formData.model.includes('gpt-4o') || formData.model === 'gpt-4-turbo') && (
                    <>
                      <option value="16000">16.000 tokens - Documentos longos</option>
                      <option value="32000">32.000 tokens - Relatórios extensos</option>
                    </>
                  )}
                  {formData.model.includes('gpt-4.1') && (
                    <option value="64000">64.000 tokens - Análises muito extensas</option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Limite de tokens para a resposta do agente
                </p>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Prompt do Sistema
            </label>
            <textarea
              id="system_prompt"
              value={formData.system_prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Define como o agente deve se comportar e responder
            </p>
          </div>

          {/* Tools */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ferramentas Disponíveis
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'rag', name: 'RAG (Busca em Documentos)', desc: 'Acesso às bases de conhecimento', recommended: true },
                { id: 'web_search', name: 'Pesquisa na Web', desc: 'Busca informações atualizadas online', recommended: false },
                { id: 'reasoning', name: 'Raciocínio Avançado', desc: 'Pensamento estruturado e lógico', recommended: false },
                { id: 'calculator', name: 'Calculadora', desc: 'Cálculos matemáticos precisos', recommended: false }
              ].map(tool => (
                <label key={tool.id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.tools_config.includes(tool.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.tools_config.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {tool.name} {tool.recommended && <span className="text-green-600 text-xs">(Recomendado)</span>}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {tool.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 RAG é recomendado para agentes que trabalham com documentos e bases de conhecimento
            </p>
          </div>

          {/* Collections */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bases de Conhecimento (Coleções)
            </label>
            
            {loadingCollections ? (
              <div className="flex items-center gap-2 py-4">
                <div className="loading"></div>
                <span className="text-gray-600">Carregando coleções...</span>
              </div>
            ) : collections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          <div className="flex gap-4 pt-4 border-t">
            <Link
              href="/agents"
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
                  <Bot size={16} />
                  Criar Agente
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}