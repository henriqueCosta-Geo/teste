'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Bot, Users, Search, ArrowRight } from 'lucide-react'
import { agentsAPI, teamsAPI } from '@/lib/api'
import { useUserMetadata } from '@/hooks/useUserMetadata'
import type { Agent } from '@/lib/types'

export default function RegularUserHome() {
  const { metadata, loading: metadataLoading } = useUserMetadata()
  const [agents, setAgents] = useState<Agent[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const promises = []

      // REGULAR só tem acesso a agentes e teams para chat
      promises.push(agentsAPI.list(false))
      promises.push(teamsAPI.list())

      const results = await Promise.allSettled(promises)

      if (results[0].status === 'fulfilled') {
        setAgents(results[0].value)
      }
      if (results[1].status === 'fulfilled') {
        setTeams(results[1].value)
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  if (metadataLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          {metadata?.chat?.welcome_message || 'Carregando chat...'}
        </span>
      </div>
    )
  }

  // Aplicar tema e cor primária do customer
  const primaryColor = metadata?.ui?.primary_color || '#3B82F6'
  const customerName = metadata?.customer?.name || 'Cliente'
  const welcomeMessage = metadata?.chat?.welcome_message || 'Olá! Como posso ajudá-lo hoje?'

  // Criar link para chat baseado no default_agent ou default_team
  const defaultChatLink = metadata?.chat?.default_agent
    ? `/agents/${metadata.chat.default_agent}/chat`
    : metadata?.chat?.default_team
    ? `/teams/${metadata.chat.default_team}/chat`
    : agents.length > 0
    ? `/agents/${agents[0].id}/chat`
    : '/search'

  const activeAgents = agents.filter(agent => agent.is_active)

  return (
    <div className="space-y-6" style={{ '--primary-color': primaryColor } as any}>
      {/* Header com branding customizado */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Bem-vindo ao {customerName}
        </h1>
        <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
          {welcomeMessage}
        </p>
      </div>

      {/* Main Chat Card */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/40 text-center py-12">
        <div className="max-w-md mx-auto">
          <MessageCircle size={64} className="mx-auto mb-6" style={{ color: primaryColor }} />
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Iniciar Conversa
          </h2>
          <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
            {metadata?.chat?.default_agent
              ? `Converse com nosso agente especializado`
              : metadata?.chat?.default_team
              ? `Fale com nossa equipe de atendimento`
              : 'Escolha como deseja conversar'
            }
          </p>
          <Link
            href={defaultChatLink}
            className="btn-primary btn-lg inline-flex items-center gap-3 text-lg px-8 py-4"
          >
            <MessageCircle size={20} />
            Começar Chat
          </Link>
        </div>
      </div>

      {/* Available Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Agents */}
        {activeAgents.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                🤖 Agentes Disponíveis
              </h2>
            </div>

            <div className="space-y-3">
              {activeAgents.slice(0, 4).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {agent.name}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {agent.description || 'Especialista em atendimento'}
                    </p>
                  </div>
                  <Link
                    href={`/agents/${agent.id}/chat`}
                    className="btn-outline btn-sm"
                  >
                    Conversar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Teams */}
        {teams.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                👥 Times Disponíveis
              </h2>
            </div>

            <div className="space-y-3">
              {teams.slice(0, 4).map((team) => (
                <div key={team.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {team.name}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {team.description || 'Equipe especializada'}
                    </p>
                  </div>
                  <Link
                    href={`/teams/${team.id}/chat`}
                    className="btn-outline btn-sm"
                  >
                    Conversar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Option */}
      <div className="card text-center">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          🔍 Busca Inteligente
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Procure informações específicas em nossa base de conhecimento
        </p>
        <Link
          href="/search"
          className="btn-secondary inline-flex items-center gap-2"
        >
          <Search size={16} />
          Fazer Busca
        </Link>
      </div>

      {/* Footer info */}
      <div className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <p>
          Powered by {customerName} • Suporte via IA disponível 24/7
        </p>
      </div>
    </div>
  )
}