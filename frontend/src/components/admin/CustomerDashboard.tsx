'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, Calendar, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { adminAPI } from '@/lib/admin-api'
import type { DashboardData, DashboardFilters } from '@/lib/admin-types'

import DashboardFiltersComponent from './DashboardFilters'
import OverviewSection from './sections/OverviewSection'
import TokenConsumptionSection from './sections/TokenConsumptionSection'
import AgentsPerformanceSection from './sections/AgentsPerformanceSection'
import ConversationInsightsSection from './sections/ConversationInsightsSection'
import RAGAnalyticsSection from './sections/RAGAnalyticsSection'
import QualityMetricsSection from './sections/QualityMetricsSection'

interface CustomerDashboardProps {
  customerId: number
}

export default function CustomerDashboard({ customerId }: CustomerDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>({
    period: '30d'
  })

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const daysBack = getPeriodDays(filters.period)
      const dashboardData = await adminAPI.getDashboard(customerId, daysBack)
      setData(dashboardData)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const getPeriodDays = (period: string): number => {
    switch (period) {
      case '7d': return 7
      case '30d': return 30
      case '90d': return 90
      case '365d': return 365
      default: return 30
    }
  }

  const handleExportJSON = async () => {
    try {
      const daysBack = getPeriodDays(filters.period)
      const blob = await adminAPI.exportDashboardJSON(customerId, daysBack)
      const filename = `dashboard-customer-${customerId}-${new Date().toISOString().split('T')[0]}.json`
      adminAPI.downloadExport(blob, filename)
    } catch (err) {
      console.error('Erro ao exportar:', err)
      alert('Erro ao exportar dados')
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [customerId, filters.period])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Carregando dashboard...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400 mb-4">❌ {error}</p>
          <button onClick={loadDashboard} className="btn-primary">
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Dashboard de Administração
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Plano: {data.overview.plan_type} • {data.overview.total_chats} chats • {data.overview.total_messages} mensagens (últimos {data.overview.period_days} dias)
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/teams/8/chat" className="btn-primary flex items-center gap-2">
            <MessageCircle size={20} />
            Iniciar Chat
          </Link>
          <button onClick={loadDashboard} className="btn-outline" title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <button onClick={handleExportJSON} className="btn-outline" title="Exportar JSON">
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <DashboardFiltersComponent filters={filters} onChange={setFilters} />

      {/* Sections */}
      <OverviewSection data={data.overview} />

      <TokenConsumptionSection data={data.token_consumption} />

      <AgentsPerformanceSection data={data.agents_performance} />

      <ConversationInsightsSection data={data.conversation_insights} />

      <RAGAnalyticsSection data={data.rag_analytics} />

      <QualityMetricsSection data={data.quality_metrics} />
    </div>
  )
}
