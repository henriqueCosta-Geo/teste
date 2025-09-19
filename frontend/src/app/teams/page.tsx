'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Users, Crown, UserPlus, Trash2, Eye } from 'lucide-react'
import { teamsAPI } from '@/lib/api'
import { PageLayout, PageLayoutSkeleton, EmptyState } from '@/components/layout/page-layout'
import { TeamCard } from '@/components/ui/cards'
import RoleGuard from '@/components/auth/RoleGuard'

interface Team {
  id: number
  name: string
  description: string
  leader_agent_id?: number
  is_active: boolean
  created_at: string
  leader?: {
    id: number
    name: string
    role: string
  }
  members?: Array<{
    agent_id: number
    role_in_team: string
    agent: {
      id: number
      name: string
      role: string
    }
  }>
  _count?: {
    members: number
  }
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  
  // Memoize stats computations
  const stats = useMemo(() => ({
    total: teams.length,
    active: teams.filter(t => t.is_active).length
  }), [teams])

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const data = await teamsAPI.list()
      console.log('Times carregados:', data)
      setTeams(data)
    } catch (error) {
      console.error('Erro ao carregar times:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Tem certeza que deseja deletar o time "${name}"?`)) {
      try {
        await teamsAPI.delete(id)
        await loadTeams() // Reload the list
      } catch (error) {
        console.error('Erro ao deletar time:', error)
        alert('Erro ao deletar time')
      }
    }
  }

  if (loading) {
    return <PageLayoutSkeleton />
  }

  return (
    <RoleGuard allowedRoles={['SUPER_USER']} redirectTo="/">
      <PageLayout
      title="Times de Agentes"
      subtitle="Gerencie grupos de agentes para trabalho colaborativo"
      stats={[
        { icon: <Users size={14} />, label: '', value: stats.total },
        { icon: <Crown size={14} />, label: 'ativos', value: stats.active }
      ]}
      actions={
        <Link href="/teams/create" className="btn-primary">
          <Plus size={16} />
          Novo Time
        </Link>
      }
    >

      {/* Teams List */}
      {teams.length > 0 ? (
        <div className="space-y-4">
          {teams.map((team, index) => (
            <div key={team.id} className={`stagger-${Math.min(index % 4, 4)}`}>
              <TeamCard team={team} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={64} />}
          title="Nenhum time encontrado"
          description="Crie seu primeiro time para colaboração entre agentes"
          action={
            <Link href="/teams/create" className="btn-primary">
              <Plus size={16} />
              Criar primeiro time
            </Link>
          }
        />
      )}
      </PageLayout>
    </RoleGuard>
  )
}