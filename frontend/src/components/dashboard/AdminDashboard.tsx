'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Database, Bot, FileText, Search, Plus, ArrowRight, Activity, Users, MessageCircle } from 'lucide-react'
import { collectionsAPI, agentsAPI } from '@/lib/api'
import { useUserMetadata } from '@/hooks/useUserMetadata'
import type { Collection, Agent } from '@/lib/types'

export default function AdminDashboard() {
  const { metadata, loading: metadataLoading } = useUserMetadata()
  const [collections, setCollections] = useState<Collection[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const promises = []

      // ADMIN tem acesso às funcionalidades do seu customer
      promises.push(collectionsAPI.list())
      promises.push(agentsAPI.list(false))
      promises.push(fetch('/api/teams').then(res => res.ok ? res.json() : []))

      const results = await Promise.allSettled(promises)

      if (results[0].status === 'fulfilled') {
        setCollections(results[0].value)
      }
      if (results[1].status === 'fulfilled') {
        setAgents(results[1].value)
      }
      if (results[2].status === 'fulfilled') {
        setTeams(results[2].value)
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
          {metadata?.chat?.welcome_message || 'Carregando dashboard...'}
        </span>
      </div>
    )
  }

  const totalFiles = collections.reduce((sum, col) => sum + col.files_count, 0)
  const totalChunks = collections.reduce((sum, col) => sum + col.chunks_count, 0)
  const activeAgents = agents.filter(agent => agent.is_active).length

  // Aplicar tema e cor primária do customer
  const primaryColor = metadata?.ui?.primary_color || '#3B82F6'
  const customerName = metadata?.customer?.name || 'Cliente'

  const statsCards = [
    {
      label: 'Coleções',
      value: collections.length,
      icon: <Database className="h-6 w-6" />,
      color: 'blue'
    },
    {
      label: 'Agentes Ativos',
      value: activeAgents,
      icon: <Bot className="h-6 w-6" />,
      color: 'green'
    },
    {
      label: 'Times',
      value: teams.length,
      icon: <Users className="h-6 w-6" />,
      color: 'purple'
    },
    {
      label: 'Arquivos',
      value: totalFiles,
      icon: <FileText className="h-6 w-6" />,
      color: 'yellow'
    },
    {
      label: 'Chunks',
      value: totalChunks.toLocaleString(),
      icon: <Activity className="h-6 w-6" />,
      color: 'orange'
    }
  ]

  const quickActions = [
    {
      href: '/collections',
      label: 'Nova Coleção',
      icon: <Plus size={16} />,
      style: 'primary'
    },
    {
      href: '/agents',
      label: 'Novo Agente',
      icon: <Bot size={16} />,
      style: 'secondary'
    },
    {
      href: '/teams',
      label: 'Novo Time',
      icon: <Users size={16} />,
      style: 'secondary'
    },
    {
      href: '/search',
      label: 'Buscar',
      icon: <Search size={16} />,
      style: 'outline'
    }
  ]

  // Criar link para chat baseado no default_agent ou default_team
  const defaultChatLink = metadata?.chat?.default_agent
    ? `/agents/${metadata.chat.default_agent}/chat`
    : metadata?.chat?.default_team
    ? `/teams/${metadata.chat.default_team}/chat`
    : '/search'

  return (
    <div className="space-y-6" style={{ '--primary-color': primaryColor } as any}>
      {/* Header com branding customizado */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {customerName} Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {metadata?.chat?.welcome_message || 'Gerencie recursos e converse com agentes IA'}
        </p>
      </div>

      {/* Quick Chat Access */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              💬 Iniciar Conversa
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {metadata?.chat?.default_agent
                ? `Converse com o agente ${metadata.chat.default_agent}`
                : metadata?.chat?.default_team
                ? `Converse com o time ${metadata.chat.default_team}`
                : 'Busque informações na base de conhecimento'
              }
            </p>
          </div>
          <Link
            href={defaultChatLink}
            className="btn-primary"
          >
            <MessageCircle size={16} />
            Iniciar Chat
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statsCards.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center">
              <div className={`p-2 bg-${stat.color}-100 dark:bg-${stat.color}-900/30 rounded-lg`}>
                <div className={`text-${stat.color}-600 dark:text-${stat.color}-400`}>
                  {stat.icon}
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Coleções Recentes
            </h2>
            <Link
              href="/collections"
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: primaryColor }}
            >
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {collections.slice(0, 3).map((collection) => (
              <div key={collection.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {collection.name}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {collection.files_count} arquivos • {collection.chunks_count} chunks
                  </p>
                </div>
                <Link
                  href={`/collections/${collection.id}`}
                  className="transition-colors"
                  style={{ color: primaryColor }}
                >
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}

            {collections.length === 0 && (
              <div className="text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
                <Database size={48} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p>Nenhuma coleção encontrada</p>
                <Link href="/collections" className="btn-primary mt-3 inline-flex">
                  <Plus size={16} />
                  Criar primeira coleção
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Agents Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Agentes Disponíveis
            </h2>
            <Link
              href="/agents"
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: primaryColor }}
            >
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {agents.slice(0, 3).map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {agent.model}
                    </span>
                    <span className={`badge ${agent.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {agent.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/agents/${agent.id}/chat`}
                  className="transition-colors"
                  style={{ color: primaryColor }}
                >
                  <MessageCircle size={16} />
                </Link>
              </div>
            ))}

            {agents.length === 0 && (
              <div className="text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
                <Bot size={48} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p>Nenhum agente encontrado</p>
                <Link href="/agents" className="btn-primary mt-3 inline-flex">
                  <Plus size={16} />
                  Criar primeiro agente
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className={`btn-${action.style} justify-center`}
            >
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}