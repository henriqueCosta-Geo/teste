'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { CustomerMetadata } from '@/lib/types'

interface UserMetadata extends CustomerMetadata {
  customer: {
    id: number
    name: string
    slug: string
  }
  permissions: {
    can_manage_agents: boolean
    can_manage_collections: boolean
    can_manage_teams: boolean
    can_view_analytics: boolean
    can_manage_users: boolean
    can_manage_settings: boolean
  }
}

export function useUserMetadata() {
  const { data: session, status } = useSession()
  const [metadata, setMetadata] = useState<UserMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      setLoading(false)
      return
    }

    fetchUserMetadata()
  }, [session, status])

  const fetchUserMetadata = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/user/metadata')
      if (!response.ok) {
        throw new Error('Erro ao carregar metadados do usuário')
      }

      const data = await response.json()
      setMetadata(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const hasFeature = (feature: 'agents' | 'collections' | 'teams' | 'analytics') => {
    return metadata?.features?.[feature] !== false
  }

  const hasPermission = (permission: keyof UserMetadata['permissions']) => {
    return metadata?.permissions?.[permission] === true
  }

  const getLimit = (limit: 'max_users' | 'max_agents' | 'max_collections' | 'storage_mb') => {
    return metadata?.limits?.[limit] || 0
  }

  const isWithinLimit = (limit: 'max_users' | 'max_agents' | 'max_collections' | 'storage_mb', currentCount: number) => {
    const limitValue = getLimit(limit)
    return limitValue === -1 || currentCount < limitValue
  }

  return {
    metadata,
    loading,
    error,
    hasFeature,
    hasPermission,
    getLimit,
    isWithinLimit,
    refetch: fetchUserMetadata
  }
}