import React from 'react'
import { useFeatureEnabled } from '@/hooks/useCustomerMetadata'
import { CustomerMetadata } from '@/lib/types'

interface ConditionalFeatureProps {
  feature: keyof NonNullable<CustomerMetadata['features']>
  children: React.ReactNode
  fallback?: React.ReactNode
  showFallback?: boolean
}

export const ConditionalFeature: React.FC<ConditionalFeatureProps> = ({
  feature,
  children,
  fallback = null,
  showFallback = false
}) => {
  const isEnabled = useFeatureEnabled(feature)

  if (isEnabled) {
    return <>{children}</>
  }

  if (showFallback && fallback) {
    return <>{fallback}</>
  }

  return null
}

// Componentes específicos para features comuns
export const AgentsFeature: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <ConditionalFeature feature="agents" fallback={fallback}>
    {children}
  </ConditionalFeature>
)

export const CollectionsFeature: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <ConditionalFeature feature="collections" fallback={fallback}>
    {children}
  </ConditionalFeature>
)

export const TeamsFeature: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <ConditionalFeature feature="teams" fallback={fallback}>
    {children}
  </ConditionalFeature>
)

export const AnalyticsFeature: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <ConditionalFeature feature="analytics" fallback={fallback}>
    {children}
  </ConditionalFeature>
)

// Componente para mostrar aviso de feature desabilitada
export const FeatureDisabledWarning: React.FC<{
  feature: string
  planType?: string
}> = ({ feature, planType }) => (
  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span className="font-medium">Feature não disponível</span>
    </div>
    <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
      O recurso "{feature}" não está habilitado para este customer.
      {planType && ` Considere fazer upgrade para um plano superior.`}
    </p>
  </div>
)