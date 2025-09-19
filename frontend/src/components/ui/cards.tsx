import React from 'react'
import Link from 'next/link'
import { MessageSquare, Settings, Trash2, Eye, Users, Building2, TestTube } from 'lucide-react'

// Base Card Component
interface BaseCardProps {
  className?: string
  children: React.ReactNode
}

export const BaseCard: React.FC<BaseCardProps> = ({ className = '', children }) => (
  <div className={`card hover-lift gpu-accelerated fade-in ${className}`}>
    {children}
  </div>
)

// Agent Card Component
interface AgentCardProps {
  agent: {
    id: number
    name: string
    role?: string
    description?: string
    model: string
    is_active: boolean
    collections?: Array<{ id: number; name: string }>
  }
  onDelete: (id: number, name: string) => void
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onDelete }) => (
  <BaseCard>
    {/* Header */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${
          agent.is_active 
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {agent.name}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
            {agent.role || 'Assistente'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          agent.is_active 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {agent.is_active ? 'Ativo' : 'Inativo'}
        </span>
        <button
          onClick={() => onDelete(agent.id, agent.name)}
          className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 dark:hover:bg-red-900/20"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>

    {/* Description */}
    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
      {agent.description || 'Agente IA para processamento de documentos'}
    </p>

    {/* Stats */}
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          Modelo
        </div>
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {agent.model}
        </div>
      </div>
      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          Coleções
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {agent.collections?.length || 0}
        </div>
      </div>
    </div>

    {/* Collections */}
    {agent.collections && agent.collections.length > 0 && (
      <div className="mb-3">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Coleções ({agent.collections.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {agent.collections.slice(0, 3).map((collection) => (
            <span 
              key={collection.id}
              className="px-2 py-1 text-xs rounded"
              style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                color: 'var(--text-secondary)' 
              }}
            >
              {collection.name}
            </span>
          ))}
          {agent.collections.length > 3 && (
            <span 
              className="px-2 py-1 text-xs rounded"
              style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                color: 'var(--text-tertiary)' 
              }}
            >
              +{agent.collections.length - 3}
            </span>
          )}
        </div>
      </div>
    )}

    {/* Actions */}
    <div className="flex gap-2">
      <Link
        href={`/agents/${agent.id}/chat`}
        className="btn-primary flex-1 justify-center"
      >
        <MessageSquare size={14} />
        Chat
      </Link>
      <Link
        href={`/agents/${agent.id}`}
        className="btn-outline"
      >
        <Settings size={14} />
      </Link>
    </div>
  </BaseCard>
)

// Team Card Component
interface TeamCardProps {
  team: {
    id: number
    name: string
    description?: string
    is_active: boolean
    leader?: { name: string; role: string }
    members?: Array<{ agent: { name: string; role: string } }>
    _count?: { members: number }
    created_at: string
  }
  onDelete: (id: number, name: string) => void
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, onDelete }) => (
  <BaseCard className="col-span-full">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-2xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {team.name}
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              team.is_active 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {team.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        {/* Description */}
        {team.description && (
          <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {team.description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {team.leader && (
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                LÍDER
              </div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {team.leader.name}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {team.leader.role}
              </div>
            </div>
          )}
          
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              MEMBROS
            </div>
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {team._count?.members || team.members?.length || 0}
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              CRIADO EM
            </div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              {new Date(team.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Members */}
        {team.members && team.members.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
              Membros do Time
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {team.members.map((member, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {member.agent.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {member.agent.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href={`/teams/${team.id}`}
          className="btn-outline"
          title="Ver detalhes"
        >
          <Eye size={16} />
          Detalhes
        </Link>
        <Link
          href={`/teams/${team.id}/chat`}
          className="btn-primary hover-glow"
          title="Chat com o time"
        >
          <Users size={16} />
          Chat
        </Link>
        <button
          onClick={() => onDelete(team.id, team.name)}
          className="btn-ghost text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
          title="Deletar time"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  </BaseCard>
)

// Customer Card Component
interface CustomerCardProps {
  customer: {
    id: number
    name: string
    slug: string
    is_active: boolean
    metadata_file?: string
    users_count?: number
    agents_count?: number
    collections_count?: number
    created_at: string
  }
  onDelete: (id: number, name: string) => void
  onSimulate: (customer: any) => void
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onDelete, onSimulate }) => {

  return (
    <BaseCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            customer.is_active
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
          }`}>
            <Building2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {customer.name}
            </h3>
            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
              /{customer.slug}
            </p>
          </div>
        </div>

        <button
          onClick={() => onDelete(customer.id, customer.name)}
          className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-700 dark:hover:bg-red-900/20"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Status */}
      <div className="mb-3">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          customer.is_active
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {customer.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Usuários
          </div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {customer.users_count || 0}
          </div>
        </div>
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Agentes
          </div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {customer.agents_count || 0}
          </div>
        </div>
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Coleções
          </div>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {customer.collections_count || 0}
          </div>
        </div>
      </div>

      {/* Metadata Info */}
      {customer.metadata_file && (
        <div className="mb-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
            Metadados configurados
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {customer.metadata_file.split('/').pop()?.replace('.toml', '') || 'Configurado'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => onSimulate(customer)}
          className="btn-secondary flex-1 justify-center"
          title="Testar & Simular"
        >
          <TestTube size={14} />
          Testar
        </button>
        <Link
          href={`/admin/customers/${customer.id}`}
          className="btn-outline"
          title="Ver detalhes"
        >
          <Eye size={14} />
        </Link>
        <Link
          href={`/admin/customers/${customer.id}/edit`}
          className="btn-outline"
          title="Configurações"
        >
          <Settings size={14} />
        </Link>
      </div>

      {/* Additional Actions */}
      <div className="flex gap-2">
        <Link
          href={`/admin/customers/${customer.id}/users`}
          className="btn-primary flex-1 justify-center"
          title="Gerenciar usuários"
        >
          <Users size={14} />
          Usuários
        </Link>
      </div>

      {/* Quick Info */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Criado em {new Date(customer.created_at).toLocaleDateString()}
        </div>
      </div>
    </BaseCard>
  )
}