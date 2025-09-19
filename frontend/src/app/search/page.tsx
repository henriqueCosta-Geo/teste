'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, MessageSquare, Settings, Bot, Brain } from 'lucide-react'
import { agentsAPI } from '@/lib/api'
import type { Agent } from '@/lib/types'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const data = await agentsAPI.list(true)
      setAgents(data)
    } catch (error) {
      console.error('Erro ao carregar agentes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Tem certeza que deseja deletar o agente "${name}"?`)) {
      try {
        await agentsAPI.delete(id)
        await loadAgents()
      } catch (error) {
        alert('Erro ao deletar agente')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3 text-gray-600">Carregando agentes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes IA</h1>
          <p className="text-gray-600">Gerencie seus assistentes inteligentes com acesso RAG</p>
        </div>
        <Link href="/agents/create" className="btn-primary">
          <Plus size={16} />
          Novo Agente
        </Link>
      </div>

      {/* Agents Grid */}
      {agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div key={agent.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${agent.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Bot size={20} className={agent.is_active ? 'text-green-600' : 'text-gray-400'} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
                    <p className="text-sm text-gray-600">{agent.role || 'Assistente geral'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${agent.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {agent.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button
                    onClick={() => handleDelete(agent.id, agent.name)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {agent.description || 'Agente IA para processamento de documentos'}
              </p>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Modelo:</span>
                  <span className="font-medium">{agent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Temperature:</span>
                  <span className="font-medium">{agent.temperature}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ferramentas:</span>
                  <span className="font-medium">
                    {agent.tools_config?.length > 0 
                      ? agent.tools_config.join(', ') 
                      : 'RAG apenas'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Coleções:</span>
                  <span className="font-medium">
                    {agent.collections?.length || 0}
                  </span>
                </div>
              </div>

              {/* Collections List */}
              {agent.collections && agent.collections.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-700 mb-2">Bases de Conhecimento:</p>
                  <div className="space-y-1">
                    {agent.collections.slice(0, 2).map((collection) => (
                      <div key={collection.id} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span className="text-gray-600">{collection.name}</span>
                        <span className="badge badge-blue text-xs">{collection.access_level}</span>
                      </div>
                    ))}
                    {agent.collections.length > 2 && (
                      <p className="text-xs text-gray-500">
                        +{agent.collections.length - 2} outras...
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  href={`/agents/${agent.id}/chat`}
                  className="btn-primary flex-1 justify-center text-sm"
                >
                  <MessageSquare size={14} />
                  Chat
                </Link>
                <Link
                  href={`/agents/${agent.id}`}
                  className="btn-outline justify-center text-sm"
                >
                  <Settings size={14} />
                  Config
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bot size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum agente encontrado
          </h3>
          <p className="text-gray-600 mb-6">
            Crie seu primeiro agente IA para começar a conversar com seus documentos
          </p>
          <Link href="/agents/create" className="btn-primary">
            <Plus size={16} />
            Criar primeiro agente
          </Link>
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-green-50 border-green-200">
        <div className="flex items-start gap-3">
          <Brain className="text-green-600 mt-1" size={20} />
          <div>
            <h4 className="font-medium text-green-900 mb-1">
              Como funcionam os agentes?
            </h4>
            <p className="text-green-800 text-sm">
              Os agentes IA têm acesso às suas coleções de documentos via RAG (Retrieval Augmented Generation). 
              Eles podem buscar informações relevantes e responder perguntas baseadas no conteúdo dos seus arquivos, 
              além de usar ferramentas como busca na web quando configuradas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}