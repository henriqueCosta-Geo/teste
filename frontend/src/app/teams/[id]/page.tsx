'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Crown, MessageSquare, Settings, Calendar, User, Trash2, AlertCircle } from 'lucide-react'
import { teamsAPI } from '@/lib/api'

interface TeamMember {
  agent_id: number
  role_in_team: string
  agent: {
    id: number
    name: string
    role: string
  }
}

interface Team {
  id: number
  name: string
  description?: string
  leader_agent_id?: number
  leader?: {
    id: number
    name: string
    role: string
  }
  is_active: boolean
  created_at: string
  members: TeamMember[]
  _count: {
    members: number
  }
}

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadTeam()
    }
  }, [params.id])

  const loadTeam = async () => {
    try {
      setLoading(true)
      setError(false)
      
      const teamId = parseInt(params.id as string)
      if (isNaN(teamId)) {
        setError(true)
        return
      }
      
      console.log('Carregando detalhes do team ID:', teamId)
      
      // Usar a API lib diretamente para evitar problemas de proxy
      const data = await teamsAPI.get(teamId)
      console.log('Team detalhado carregado:', data)
      setTeam(data)
      
    } catch (error) {
      console.error('Erro ao carregar time:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!team) return
    
    if (window.confirm(`Tem certeza que deseja deletar o time "${team.name}"? Esta ação não pode ser desfeita.`)) {
      try {
        const response = await fetch(`/api/proxy/api/agents/teams/${team.id}`, {
          method: 'DELETE'
        })
        
        if (!response.ok) {
          throw new Error('Erro ao deletar time')
        }
        
        router.push('/teams')
      } catch (error) {
        console.error('Erro ao deletar time:', error)
        alert('Erro ao deletar time')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3 text-gray-600">Carregando detalhes do time...</span>
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <Users size={64} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Time não encontrado
        </h3>
        <p className="text-gray-600 mb-6">
          O time solicitado não existe ou não está disponível.
        </p>
        <button
          onClick={() => router.push('/teams')}
          className="btn-primary"
        >
          <ArrowLeft size={16} />
          Voltar aos times
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/teams"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${team.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Users size={24} className={team.is_active ? 'text-green-600' : 'text-gray-400'} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-gray-600">
                {team.description || 'Time de agentes colaborativos'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`badge ${team.is_active ? 'badge-green' : 'badge-gray'}`}>
            {team.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Membros</p>
              <p className="text-xl font-bold text-gray-900">{team._count.members}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Crown className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Líder</p>
              <p className="text-xl font-bold text-gray-900">
                {team.leader ? team.leader.name : 'Nenhum'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Criado em</p>
              <p className="text-xl font-bold text-gray-900">
                {new Date(team.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Leader */}
      {team.leader && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Crown size={20} className="text-yellow-500" />
            Líder do Time
          </h2>
          <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Crown size={20} className="text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{team.leader.name}</h3>
              <p className="text-sm text-gray-600">{team.leader.role}</p>
              <p className="text-xs text-yellow-700 mt-1">
                Coordena as atividades do time e sintetiza as respostas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-500" />
          Membros do Time ({team._count.members})
        </h2>
        
        {team.members.length > 0 ? (
          <div className="space-y-3">
            {team.members.map((member) => (
              <div key={member.agent_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{member.agent.name}</h3>
                      {team.leader_agent_id === member.agent_id && (
                        <Crown size={14} className="text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{member.agent.role}</p>
                    <p className="text-xs text-gray-500">Papel no time: {member.role_in_team}</p>
                  </div>
                </div>
                <Link
                  href={`/agents/${member.agent_id}`}
                  className="btn-outline text-sm"
                >
                  <Settings size={14} />
                  Ver Agente
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Nenhum membro encontrado</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href={`/teams/${team.id}/chat`}
          className="btn-primary flex-1 justify-center"
        >
          <MessageSquare size={16} />
          Chat com Time
        </Link>
        <Link
          href="/teams"
          className="btn-outline"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200">
        <h3 className="text-lg font-medium text-red-900 mb-4">Zona de Perigo</h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-red-800">Deletar este time permanentemente</p>
            <p className="text-sm text-red-600">Esta ação não pode ser desfeita.</p>
          </div>
          <button
            onClick={handleDelete}
            className="btn-danger"
          >
            <Trash2 size={16} />
            Deletar Time
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Users className="text-blue-600 mt-1" size={20} />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">
              Como funcionam os times?
            </h4>
            <div className="text-blue-800 text-sm space-y-1">
              <p>• <strong>Colaboração:</strong> Múltiplos agentes trabalham em conjunto para responder perguntas</p>
              <p>• <strong>Especialização:</strong> Cada agente contribui com sua expertise específica</p>
              <p>• <strong>Liderança:</strong> {team.leader ? 'O líder coordena e sintetiza as respostas' : 'Modo colaborativo sem líder'}</p>
              <p>• <strong>Bases de Conhecimento:</strong> Acesso combinado às coleções de todos os membros</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}