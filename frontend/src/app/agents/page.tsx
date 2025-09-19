'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Trash2, MessageSquare, Settings, Bot, Brain } from 'lucide-react'
import { agentsAPI } from '@/lib/api'
import type { Agent } from '@/lib/types'
import { GridSkeleton, HeaderSkeleton } from '@/components/ui/skeleton'
import { PageLayout, PageLayoutSkeleton, EmptyState } from '@/components/layout/page-layout'
import { AgentCard } from '@/components/ui/cards'
import RoleGuard from '@/components/auth/RoleGuard'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  
  // Memoize stats computations
  const stats = useMemo(() => ({
    total: agents.length,
    active: agents.filter(a => a.is_active).length
  }), [agents])

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
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
    return <PageLayoutSkeleton />
  }

  return (
    <RoleGuard allowedRoles={['SUPER_USER']} redirectTo="/">
      <PageLayout
      title="Agentes IA"
      subtitle="Gerencie seus assistentes inteligentes"
      stats={[
        { icon: <Bot size={14} />, label: '', value: stats.total },
        { icon: <Brain size={14} />, label: 'ativos', value: stats.active }
      ]}
      actions={
        <Link href="/agents/create" className="btn-primary">
          <Plus size={16} />
          Novo
        </Link>
      }
    >

      {/* Agents Grid */}
      {agents.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {agents.map((agent, index) => (
            <div key={agent.id} className={`stagger-${Math.min(index % 4, 4)}`}>
              <AgentCard agent={agent} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bot size={64} />}
          title="Nenhum agente encontrado"
          description="Crie seu primeiro agente IA para começar a conversar com seus documentos"
          action={
            <Link href="/agents/create" className="btn-primary">
              <Plus size={16} />
              Criar primeiro agente
            </Link>
          }
        />
      )}
      </PageLayout>
    </RoleGuard>
  )
}