'use client'

import { useState, useEffect, useContext, createContext, ReactNode } from 'react'
import { CustomerMetadata } from '@/lib/types'

interface CustomerContext {
  customerSlug: string
  metadata: CustomerMetadata | null
  isLoading: boolean
  error: string | null
  userPermissions: any | null
  refreshMetadata: () => Promise<void>
}

const CustomerMetadataContext = createContext<CustomerContext | null>(null)

interface CustomerMetadataProviderProps {
  children: ReactNode
  customerSlug?: string
}

export function CustomerMetadataProvider({ children, customerSlug }: CustomerMetadataProviderProps) {
  const [metadata, setMetadata] = useState<CustomerMetadata | null>(null)
  const [userPermissions, setUserPermissions] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetadata = async () => {
    if (!customerSlug) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Carregar metadados do customer via API
      const response = await fetch(`/api/customers/${customerSlug}/metadata`)
      if (!response.ok) {
        throw new Error(`Erro ao carregar metadados: ${response.status}`)
      }

      const customerMetadata = await response.json()
      setMetadata(customerMetadata)

      // Carregar permissões do usuário (se disponível)
      const userId = getCurrentUserId()
      if (userId) {
        try {
          const permResponse = await fetch(`/api/auth/permissions?userId=${userId}`)
          if (permResponse.ok) {
            const permissions = await permResponse.json()
            setUserPermissions(permissions)
          }
        } catch (permError) {
          console.warn('Erro ao carregar permissões:', permError)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar metadados')
      console.error('Erro ao carregar metadados:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshMetadata = async () => {
    if (customerSlug) {
      await loadMetadata()
    }
  }

  useEffect(() => {
    loadMetadata()
  }, [customerSlug])

  const contextValue: CustomerContext = {
    customerSlug: customerSlug || '',
    metadata,
    isLoading,
    error,
    userPermissions,
    refreshMetadata
  }

  return (
    <CustomerMetadataContext.Provider value={contextValue}>
      {children}
    </CustomerMetadataContext.Provider>
  )
}

export function useCustomerMetadata() {
  const context = useContext(CustomerMetadataContext)
  if (!context) {
    throw new Error('useCustomerMetadata deve ser usado dentro de CustomerMetadataProvider')
  }
  return context
}

// Hook para verificar se uma feature está habilitada
export function useFeatureEnabled(feature: keyof NonNullable<CustomerMetadata['features']>) {
  const { metadata, userPermissions } = useCustomerMetadata()

  // Se não há metadados, assume como habilitado (fallback seguro)
  if (!metadata?.features) {
    return true
  }

  // Verificar se a feature está habilitada nos metadados
  const featureEnabled = metadata.features[feature] !== false

  // Verificar permissões do usuário
  if (userPermissions?.permissions) {
    const permissionKey = `can_manage_${feature}`
    const hasPermission = userPermissions.permissions[permissionKey] !== false
    return featureEnabled && hasPermission
  }

  return featureEnabled
}

// Hook para verificar limites
export function useCustomerLimits() {
  const { metadata, userPermissions } = useCustomerMetadata()

  const limits = metadata?.limits || {}
  const userLimits = userPermissions?.limits || {}

  return {
    maxUsers: limits.max_users || userLimits.max_users || 10,
    maxAgents: limits.max_agents || userLimits.max_agents || 5,
    maxCollections: limits.max_collections || userLimits.max_collections || 10,
    storageMB: limits.storage_mb || userLimits.storage_mb || 1000,
    isUnlimited: (resource: string) => {
      const limit = limits[`max_${resource}` as keyof typeof limits]
      return limit === -1
    }
  }
}

// Hook para verificar se uma ação está permitida
export function useActionPermission() {
  const { userPermissions } = useCustomerMetadata()

  return {
    canCreateAgent: async (currentCount: number) => {
      if (!userPermissions) return true

      try {
        const response = await fetch('/api/auth/validate-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userPermissions.user.id,
            action: 'create_agent',
            currentCount
          })
        })

        if (!response.ok) return false
        const result = await response.json()
        return result.allowed
      } catch {
        return false
      }
    },

    canCreateCollection: async (currentCount: number) => {
      if (!userPermissions) return true

      try {
        const response = await fetch('/api/auth/validate-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userPermissions.user.id,
            action: 'create_collection',
            currentCount
          })
        })

        if (!response.ok) return false
        const result = await response.json()
        return result.allowed
      } catch {
        return false
      }
    },

    canCreateUser: async (currentCount: number) => {
      if (!userPermissions) return true

      try {
        const response = await fetch('/api/auth/validate-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userPermissions.user.id,
            action: 'create_user',
            currentCount
          })
        })

        if (!response.ok) return false
        const result = await response.json()
        return result.allowed
      } catch {
        return false
      }
    }
  }
}

// Hook para configurações de UI
export function useUIConfig() {
  const { metadata } = useCustomerMetadata()

  const uiConfig = metadata?.ui || {}

  return {
    theme: uiConfig.theme || 'light',
    primaryColor: uiConfig.primary_color || '#3B82F6',
    logoPath: uiConfig.logo_path,
    showBranding: uiConfig.show_branding !== false,
    applyTheme: () => {
      // Aplicar tema dinamicamente
      if (uiConfig.primary_color) {
        document.documentElement.style.setProperty('--accent-primary', uiConfig.primary_color)
      }

      if (uiConfig.theme) {
        document.documentElement.className = uiConfig.theme === 'dark' ? 'dark' : ''
      }
    }
  }
}

// Hook para configurações de chat
export function useChatConfig() {
  const { metadata } = useCustomerMetadata()

  const chatConfig = metadata?.chat || {}

  return {
    hasHistory: chatConfig.has_history !== false,
    maxMessages: chatConfig.max_messages || 100,
    defaultAgent: chatConfig.default_agent || 'assistant',
    welcomeMessage: chatConfig.welcome_message || 'Olá! Como posso ajudar você hoje?'
  }
}

// Função auxiliar para obter ID do usuário atual
function getCurrentUserId(): number | null {
  // Implementar conforme sistema de autenticação
  // Por exemplo, através de session, JWT, ou contexto de auth

  // Placeholder - implementar baseado no seu sistema de auth
  if (typeof window !== 'undefined') {
    const userSession = localStorage.getItem('user_session')
    if (userSession) {
      try {
        const session = JSON.parse(userSession)
        return session.user?.id || null
      } catch {
        return null
      }
    }
  }

  return null
}