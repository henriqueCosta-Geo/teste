'use client'

import { Users, MessageCircle, Mail, Award } from 'lucide-react'
import type { OverviewMetrics } from '@/lib/admin-types'

interface OverviewSectionProps {
  data: OverviewMetrics
}

export default function OverviewSection({ data }: OverviewSectionProps) {
  const stats = [
    {
      label: 'Usuários Totais',
      value: data.total_users,
      subtext: `${data.active_users} ativos`,
      icon: <Users className="h-6 w-6" />,
      color: 'blue'
    },
    {
      label: 'Chats',
      value: data.total_chats,
      subtext: `Últimos ${data.period_days} dias`,
      icon: <MessageCircle className="h-6 w-6" />,
      color: 'green'
    },
    {
      label: 'Mensagens',
      value: data.total_messages.toLocaleString(),
      subtext: `${Math.round(data.total_messages / data.total_chats || 0)} por chat`,
      icon: <Mail className="h-6 w-6" />,
      color: 'purple'
    }
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        📊 Visão Geral
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {stat.label}
                </p>
                <p className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {stat.value}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {stat.subtext}
                </p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 dark:bg-${stat.color}-900/30 rounded-lg`}>
                <div className={`text-${stat.color}-600 dark:text-${stat.color}-400`}>
                  {stat.icon}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
