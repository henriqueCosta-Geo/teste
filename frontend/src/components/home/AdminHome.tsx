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
    : '/teams/3/chat'  // ✅ DEFAULT: Team ID 3


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]" style={{ '--primary-color': primaryColor } as any}>
      <div className="max-w-2xl w-full mx-auto px-4">
        {/* Header com branding customizado */}
        <div className="text-center mb-12">
          {logoPath && (
            <div className="mb-8">
              <img
                src={logoPath.startsWith('/logos/') ? `/api${logoPath}` : logoPath}
                alt={`${customerName} Logo`}
                className="h-20 w-auto mx-auto object-contain"
              />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-4" style={{ color: primaryColor }}>
            Bem-vindo ao {customerName}
          </h1>
          <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
            {welcomeMessage}
          </p>
        </div>

        {/* Call to Action Principal */}
        <div
          className="card text-center py-16"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
            borderColor: `${primaryColor}30`
          }}
        >
          <div className="mb-8">
            <MessageCircle size={80} className="mx-auto" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Comece uma Conversa
          </h2>
          <p className="text-lg mb-10 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Nossa IA está pronta para ajudar com suas dúvidas e necessidades
          </p>
          <Link
            href={defaultChatLink}
            className="btn-primary btn-lg inline-flex items-center gap-3 text-lg px-10 py-5"
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
          >
            <MessageCircle size={24} />
            Iniciar Conversa
          </Link>
        </div>
      </div>
    </div>
  )
}