'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, AlertCircle, Crown, Zap, Building2 } from 'lucide-react'
import { AgentsFeature, CollectionsFeature, TeamsFeature, AnalyticsFeature, FeatureDisabledWarning } from '@/components/conditional/ConditionalFeature'
import { ConditionalNavigation } from '@/components/conditional/ConditionalNavigation'
import { useCustomerMetadata, useFeatureEnabled, useCustomerLimits, useUIConfig, useChatConfig } from '@/hooks/useCustomerMetadata'
import { PageLayout } from '@/components/layout/page-layout'

export default function DemoPage() {
  const { metadata, isLoading, error, customerSlug, userPermissions } = useCustomerMetadata()
  const { maxUsers, maxAgents, maxCollections, isUnlimited } = useCustomerLimits()
  const { theme, primaryColor, showBranding, applyTheme } = useUIConfig()
  const { welcomeMessage, hasHistory } = useChatConfig()

  const agentsEnabled = useFeatureEnabled('agents')
  const collectionsEnabled = useFeatureEnabled('collections')
  const teamsEnabled = useFeatureEnabled('teams')
  const analyticsEnabled = useFeatureEnabled('analytics')

  useEffect(() => {
    // Aplicar configurações de UI quando os metadados carregarem
    applyTheme()
  }, [metadata])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading mb-4"></div>
          <p className="text-gray-600">Carregando configurações do customer...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro ao carregar</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const getPlanIcon = (plan?: string) => {
    switch (plan) {
      case 'ENTERPRISE':
        return <Crown size={24} className="text-purple-600" />
      case 'PROFESSIONAL':
        return <Zap size={24} className="text-blue-600" />
      default:
        return <Building2 size={24} className="text-green-600" />
    }
  }

  return (
    <PageLayout
      title="Demo Customer"
      subtitle={`Sistema multi-tenant configurado para ${customerSlug}`}
    >
      {/* Customer Info */}
      <div className="card-modern mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getPlanIcon(userPermissions?.user?.customer_plan)}
            <div>
              <h2 className="text-xl font-bold">
                Customer: {customerSlug}
              </h2>
              <p className="text-gray-600">
                Plano: {userPermissions?.user?.customer_plan || 'BASIC'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-600">Tema: {theme}</p>
            <p className="text-sm text-gray-600">Branding: {showBranding ? 'Ativo' : 'Desativado'}</p>
          </div>
        </div>

        {/* Welcome Message Preview */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Mensagem de boas-vindas:</p>
          <p className="text-blue-900 dark:text-blue-200 italic">"{welcomeMessage}"</p>
        </div>
      </div>

      {/* Navigation Conditional */}
      <div className="card-modern mb-6">
        <h3 className="text-lg font-semibold mb-4">Navegação Condicional</h3>
        <ConditionalNavigation
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          orientation="horizontal"
        />
      </div>

      {/* Limits Display */}
      <div className="card-modern mb-6">
        <h3 className="text-lg font-semibold mb-4">Limites do Plano</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isUnlimited('users') ? '∞' : maxUsers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Usuários</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isUnlimited('agents') ? '∞' : maxAgents}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Agentes</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isUnlimited('collections') ? '∞' : maxCollections}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Coleções</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round((metadata?.limits?.storage_mb || 1000) / 1024)}GB
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Storage</div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Feature */}
        <AgentsFeature
          fallback={
            <FeatureDisabledWarning
              feature="Agentes IA"
              planType={userPermissions?.user?.customer_plan}
            />
          }
        >
          <div className="card-modern">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              ✅ Agentes IA
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Habilitado</span>
            </h3>
            <p className="text-gray-600 mb-4">
              Configure assistentes IA inteligentes para processar documentos e responder perguntas.
            </p>
            <Link href="/agents" className="btn-primary">
              <Plus size={16} />
              Gerenciar Agentes
            </Link>
          </div>
        </AgentsFeature>

        {/* Collections Feature */}
        <CollectionsFeature
          fallback={
            <FeatureDisabledWarning
              feature="Coleções de Documentos"
              planType={userPermissions?.user?.customer_plan}
            />
          }
        >
          <div className="card-modern">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              ✅ Coleções
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Habilitado</span>
            </h3>
            <p className="text-gray-600 mb-4">
              Organize documentos em coleções para busca vetorial e processamento de RAG.
            </p>
            <Link href="/collections" className="btn-primary">
              <Plus size={16} />
              Gerenciar Coleções
            </Link>
          </div>
        </CollectionsFeature>

        {/* Teams Feature */}
        <TeamsFeature
          fallback={
            <FeatureDisabledWarning
              feature="Teams de Agentes"
              planType={userPermissions?.user?.customer_plan}
            />
          }
        >
          <div className="card-modern">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              ✅ Teams
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Habilitado</span>
            </h3>
            <p className="text-gray-600 mb-4">
              Coordene múltiplos agentes trabalhando em conjunto para tarefas complexas.
            </p>
            <Link href="/teams" className="btn-primary">
              <Plus size={16} />
              Gerenciar Teams
            </Link>
          </div>
        </TeamsFeature>

        {/* Analytics Feature */}
        <AnalyticsFeature
          fallback={
            <FeatureDisabledWarning
              feature="Analytics e Métricas"
              planType={userPermissions?.user?.customer_plan}
            />
          }
        >
          <div className="card-modern">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              ✅ Analytics
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Habilitado</span>
            </h3>
            <p className="text-gray-600 mb-4">
              Acompanhe métricas de desempenho, uso de tokens e insights detalhados.
            </p>
            <Link href="/analytics" className="btn-primary">
              <Plus size={16} />
              Ver Analytics
            </Link>
          </div>
        </AnalyticsFeature>
      </div>

      {/* Metadata Debug (em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="card-modern mt-6">
          <h3 className="text-lg font-semibold mb-4">Debug - Metadados (Desenvolvimento)</h3>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs overflow-auto">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </PageLayout>
  )
}