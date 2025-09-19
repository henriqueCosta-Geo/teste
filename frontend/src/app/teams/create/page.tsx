'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, AlertCircle, Bot, Crown, Plus, X } from 'lucide-react'
import { agentsAPI, teamsAPI } from '@/lib/api'
import type { Agent } from '@/lib/types'

export default function CreateTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [error, setError] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgents, setSelectedAgents] = useState<number[]>([])
  const [leaderAgent, setLeaderAgent] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    collaboration_mode: 'hierarchical' as 'hierarchical' | 'collaborative'
  })

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const data = await agentsAPI.list(false)
      const activeAgents = data.filter(agent => agent.is_active)
      setAgents(activeAgents)
    } catch (error) {
      console.error('Erro ao carregar agentes:', error)
    } finally {
      setLoadingAgents(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (selectedAgents.length < 2) {
      setError('Selecione pelo menos 2 agentes para formar um time')
      return
    }

    if (formData.collaboration_mode === 'hierarchical' && !leaderAgent) {
      setError('Para times hierárquicos, você deve selecionar um líder. Primeiro selecione os agentes, depois clique na coroa (👑) ao lado do agente que será o líder.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await teamsAPI.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
        leader_agent_id: formData.collaboration_mode === 'hierarchical' && leaderAgent ? leaderAgent : undefined,
        member_ids: selectedAgents
      })

      router.push('/teams')
    } catch (error: any) {
      setError(error.message || 'Erro ao criar time')
    } finally {
      setLoading(false)
    }
  }

  const toggleAgent = (agentId: number) => {
    setSelectedAgents(prev => {
      const newSelection = prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
      
      // Se removeu o líder, limpar a seleção de líder
      if (!newSelection.includes(leaderAgent || 0)) {
        setLeaderAgent(null)
      }
      
      return newSelection
    })
  }

  const setAsLeader = (agentId: number) => {
    if (selectedAgents.includes(agentId) && formData.collaboration_mode === 'hierarchical') {
      setLeaderAgent(leaderAgent === agentId ? null : agentId)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/teams"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Time</h1>
          <p className="text-gray-600">Crie um novo time de agentes colaborativos</p>
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
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Time *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Equipe de Suporte ao Cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o propósito e objetivos deste time..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="collaboration_mode" className="block text-sm font-medium text-gray-700 mb-2">
                Modo de Colaboração
              </label>
              <select
                id="collaboration_mode"
                value={formData.collaboration_mode}
                onChange={(e) => setFormData(prev => ({ ...prev, collaboration_mode: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="hierarchical">Hierárquico (com líder)</option>
                <option value="collaborative">Colaborativo (sem líder)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.collaboration_mode === 'hierarchical' 
                  ? 'Um agente líder coordena as respostas do time'
                  : 'Todos os agentes contribuem igualmente nas respostas'
                }
              </p>
            </div>
          </div>

          {/* Agent Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Agentes *
            </label>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Escolha pelo menos 2 agentes para formar o time.
              </p>
              {formData.collaboration_mode === 'hierarchical' && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  <Crown size={14} className="inline mr-1" />
                  <strong>Modo Hierárquico:</strong> Selecione os agentes primeiro, depois clique na coroa (👑) para definir qual será o líder.
                </div>
              )}
            </div>
            
            {loadingAgents ? (
              <div className="flex items-center gap-2 py-4">
                <div className="loading"></div>
                <span className="text-gray-600">Carregando agentes...</span>
              </div>
            ) : agents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {agents.map(agent => (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                      selectedAgents.includes(agent.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgents.includes(agent.id)}
                      onChange={() => toggleAgent(agent.id)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{agent.name}</span>
                        {leaderAgent === agent.id && (
                          <Crown size={14} className="text-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {agent.role || 'Assistente'} • {agent.model}
                      </div>
                    </div>
                    
                    {formData.collaboration_mode === 'hierarchical' && selectedAgents.includes(agent.id) && (
                      <button
                        type="button"
                        onClick={() => setAsLeader(agent.id)}
                        className={`p-2 rounded-lg border-2 transition-colors ${
                          leaderAgent === agent.id
                            ? 'bg-yellow-100 text-yellow-600 border-yellow-300'
                            : 'bg-gray-50 text-gray-600 border-gray-300 hover:text-yellow-500 hover:bg-yellow-50 hover:border-yellow-200'
                        }`}
                        title={leaderAgent === agent.id ? "Remover como líder" : "Definir como líder"}
                      >
                        <Crown size={16} />
                        <span className="sr-only">
                          {leaderAgent === agent.id ? "Remover como líder" : "Definir como líder"}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 border border-gray-200 rounded-lg">
                <Bot size={48} className="mx-auto mb-3 text-gray-300" />
                <p>Nenhum agente ativo disponível</p>
                <Link href="/agents/create" className="btn-primary mt-3 inline-flex">
                  <Plus size={16} />
                  Criar primeiro agente
                </Link>
              </div>
            )}

            {selectedAgents.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-blue-600" />
                  <span className="font-medium text-blue-900">
                    Time selecionado ({selectedAgents.length} agentes)
                  </span>
                </div>
                <div className="text-sm text-blue-800">
                  {selectedAgents.map(agentId => {
                    const agent = agents.find(a => a.id === agentId)
                    return agent ? (
                      <span key={agentId} className="inline-flex items-center gap-1 mr-2">
                        {leaderAgent === agentId && <Crown size={12} className="text-yellow-500" />}
                        {agent.name}
                        {leaderAgent === agentId && ' (Líder)'}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Users className="text-green-600 mt-0.5" size={16} />
              <div>
                <h4 className="font-medium text-green-900 mb-1">
                  Como funcionam os times?
                </h4>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>• <strong>Hierárquico:</strong> O líder coordena e sintetiza as contribuições do time</li>
                  <li>• <strong>Colaborativo:</strong> Todos os agentes contribuem igualmente na resposta</li>
                  <li>• <strong>Especialização:</strong> Cada agente traz sua expertise e bases de conhecimento</li>
                  <li>• <strong>Sinergia:</strong> O resultado é melhor que a soma das partes individuais</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <Link
              href="/teams"
              className="btn-outline flex-1 justify-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading || selectedAgents.length < 2}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Criando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  Criar Time
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}