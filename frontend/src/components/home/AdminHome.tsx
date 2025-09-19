'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Users, Bot, Search, Calendar, TrendingUp, Clock } from 'lucide-react'
import { useUserMetadata } from '@/hooks/useUserMetadata'
import { teamsAPI } from '@/lib/api'

export default function AdminHome() {
  const { metadata, loading: metadataLoading } = useUserMetadata()
  const [availableOptions, setAvailableOptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAvailableOptions()
  }, [])

  const loadAvailableOptions = async () => {
    try {
      // Carregar apenas opções de chat disponíveis
      const agentsResponse = await fetch('/api/proxy/api/agents/')
      const teams = await teamsAPI.list()

      const agents = agentsResponse.ok ? await agentsResponse.json() : []

      setAvailableOptions([
        ...agents.filter((a: any) => a.is_active).map((a: any) => ({ ...a, type: 'agent' })),
        ...teams.filter((t: any) => t.is_active).map((t: any) => ({ ...t, type: 'team' }))
      ])
    } catch (error) {
      console.error('Erro ao carregar opções:', error)
    } finally {
      setLoading(false)
    }
  }

  if (metadataLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Carregando portal...
        </span>
      </div>
    )
  }

  // Aplicar tema e cor primária do customer
  const primaryColor = metadata?.ui?.primary_color || '#3B82F6'
  const customerName = metadata?.customer?.name || 'Portal do Cliente'
  const logoPath = metadata?.ui?.logo_path
  const welcomeMessage = metadata?.chat?.welcome_message || 'Como podemos ajudá-lo hoje?'

  // Criar link para chat baseado no default_agent ou default_team
  const defaultChatLink = metadata?.chat?.default_agent
    ? `/agents/${metadata.chat.default_agent}/chat`
    : metadata?.chat?.default_team
    ? `/teams/${metadata.chat.default_team}/chat`
    : availableOptions.length > 0
    ? availableOptions[0].type === 'agent'
      ? `/agents/${availableOptions[0].id}/chat`
      : `/teams/${availableOptions[0].id}/chat`
    : '/search'


  return (
    <div className="space-y-8" style={{ '--primary-color': primaryColor } as any}>
      {/* Header com branding customizado */}
      <div className="text-center py-8">
        {logoPath && (
          <div className="mb-6">
            <img
              src={logoPath.startsWith('/logos/') ? `/api${logoPath}` : logoPath}
              alt={`${customerName} Logo`}
              className="h-16 w-auto mx-auto object-contain"
            />
          </div>
        )}
        <h1 className="text-4xl font-bold mb-4" style={{ color: primaryColor }}>
          Bem-vindo ao {customerName}
        </h1>
        <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {welcomeMessage}
        </p>
      </div>

      {/* Call to Action Principal */}
      <div className="max-w-2xl mx-auto">
        <div
          className="card text-center py-12"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
            borderColor: `${primaryColor}30`
          }}
        >
          <div className="mb-6">
            <MessageCircle size={64} className="mx-auto" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Comece uma Conversa
          </h2>
          <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Nossa IA está pronta para ajudar com suas dúvidas e necessidades
          </p>
          <Link
            href={defaultChatLink}
            className="btn-primary btn-lg inline-flex items-center gap-3 text-lg px-8 py-4"
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
          >
            <MessageCircle size={20} />
            Iniciar Conversa
          </Link>
        </div>
      </div>

      {/* Opções de Chat Disponíveis */}
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xl font-semibold mb-6 text-center" style={{ color: 'var(--text-primary)' }}>
          Escolha como deseja conversar
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableOptions.slice(0, 6).map((option) => (
            <Link
              key={`${option.type}-${option.id}`}
              href={option.type === 'agent' ? `/agents/${option.id}/chat` : `/teams/${option.id}/chat`}
              className="card hover:shadow-lg transition-all duration-200 hover:scale-105"
              style={{ borderColor: `${primaryColor}20` }}
            >
              <div className="text-center p-6">
                <div className="mb-4">
                  {option.type === 'agent' ? (
                    <Bot size={40} className="mx-auto" style={{ color: primaryColor }} />
                  ) : (
                    <Users size={40} className="mx-auto" style={{ color: primaryColor }} />
                  )}
                </div>
                <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {option.name}
                </h4>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {option.description || (option.type === 'agent' ? 'Assistente especializado' : 'Equipe de atendimento')}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: primaryColor }}>
                  <MessageCircle size={14} />
                  Conversar
                </div>
              </div>
            </Link>
          ))}

          {/* Opção de Busca */}
          <Link
            href="/search"
            className="card hover:shadow-lg transition-all duration-200 hover:scale-105"
            style={{ borderColor: `${primaryColor}20` }}
          >
            <div className="text-center p-6">
              <div className="mb-4">
                <Search size={40} className="mx-auto" style={{ color: primaryColor }} />
              </div>
              <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Busca Inteligente
              </h4>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Encontre informações específicas rapidamente
              </p>
              <div className="flex items-center justify-center gap-2 text-xs" style={{ color: primaryColor }}>
                <Search size={14} />
                Buscar
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center py-6">
          <Clock size={32} className="mx-auto mb-3" style={{ color: primaryColor }} />
          <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Disponível 24/7
          </h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nossos assistentes estão sempre prontos para ajudar
          </p>
        </div>

        <div className="card text-center py-6">
          <TrendingUp size={32} className="mx-auto mb-3" style={{ color: primaryColor }} />
          <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Respostas Inteligentes
          </h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            IA treinada com sua base de conhecimento
          </p>
        </div>

        <div className="card text-center py-6">
          <Calendar size={32} className="mx-auto mb-3" style={{ color: primaryColor }} />
          <h4 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Histórico Completo
          </h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Acesse suas conversas anteriores a qualquer momento
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t" style={{ borderColor: 'var(--border-primary)' }}>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Powered by {customerName} • Suporte inteligente via IA
        </p>
      </div>
    </div>
  )
}