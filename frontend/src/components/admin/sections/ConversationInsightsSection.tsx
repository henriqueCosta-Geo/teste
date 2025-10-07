'use client'

import { MessageCircle, Users as UsersIcon, Award } from 'lucide-react'
import type { ConversationInsights } from '@/lib/admin-types'

interface ConversationInsightsSectionProps {
  data: ConversationInsights
}

export default function ConversationInsightsSection({ data }: ConversationInsightsSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        💬 Insights de Conversas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Média de mensagens por chat
              </p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.avg_messages_per_chat.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Total de chats
              </p>
              <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.total_chats}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            👤 Usuários Mais Ativos
          </h3>
          <div className="space-y-3">
            {data.users_activity.slice(0, 5).map((user) => (
              <div
                key={user.user_id}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {user.user_name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {user.user_email}
                    </p>
                  </div>
                  {user.favorite_team && (
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                      {user.favorite_team}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Chats
                    </p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {user.chats_started}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Mensagens
                    </p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {user.messages_sent}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Último acesso
                    </p>
                    <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                      {user.last_active
                        ? new Date(user.last_active).toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {data.users_activity.length === 0 && (
              <p className="text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                Nenhuma atividade de usuário
              </p>
            )}
          </div>
        </div>

        {/* Top Teams */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            🏆 Times Mais Utilizados
          </h3>
          <div className="space-y-3">
            {data.top_teams.map((team, index) => (
              <div
                key={team.team_id}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {team.team_name}
                    </p>
                    <div className="flex items-center gap-4 text-sm mt-1">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {team.usage_count} usos
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {team.unique_users} usuários únicos
                      </span>
                    </div>
                  </div>
                  <Award className="h-5 w-5 text-yellow-500" />
                </div>
                {/* Usage bar */}
                <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                    style={{
                      width: `${Math.min(
                        (team.usage_count / (data.top_teams[0]?.usage_count || 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {data.top_teams.length === 0 && (
              <p className="text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                Nenhum time utilizado
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
