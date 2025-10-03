'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { agentsAPI, teamsAPI } from '@/lib/api'
import { useUserMetadata } from '@/hooks/useUserMetadata'
import type { Agent } from '@/lib/types'

export default function RegularUserHome() {
  const { metadata, loading: metadataLoading } = useUserMetadata()
  const [agents, setAgents] = useState<Agent[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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

  // ✅ REDIRECT AUTOMÁTICO para chat quando carregar os dados
  useEffect(() => {
    if (!metadataLoading && !loading && metadata) {
      // Criar link para chat baseado no default_agent ou default_team
      const defaultChatLink = metadata?.chat?.default_agent
        ? `/agents/${metadata.chat.default_agent}/chat`
        : metadata?.chat?.default_team
        ? `/teams/${metadata.chat.default_team}/chat`
        : agents.length > 0
        ? `/agents/${agents[0].id}/chat`
        : teams.length > 0
        ? `/teams/${teams[0].id}/chat`
        : '/search'

      // Redirecionar automaticamente
      router.push(defaultChatLink)
    }
  }, [metadataLoading, loading, metadata, agents, teams, router])

  // Mostrar loading enquanto carrega e antes do redirect
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="loading"></div>
      <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
        {metadata?.chat?.welcome_message || 'Carregando chat...'}
      </span>
    </div>
  )
}