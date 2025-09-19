import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { MetadataOrchestrator } from "@/lib/metadata-orchestrator"

export interface UserPermissions {
  user: {
    id: number
    name: string
    email: string
    role: string
    customer_slug: string
    customer_plan: string
  }
  permissions: {
    can_manage_agents: boolean
    can_manage_collections: boolean
    can_manage_teams: boolean
    can_view_analytics: boolean
    can_manage_users: boolean
    can_manage_settings: boolean
  }
  limits: {
    max_users?: number
    max_agents?: number
    max_collections?: number
    storage_mb?: number
  }
  ui: {
    theme?: string
    logo_path?: string
    primary_color?: string
    show_branding?: boolean
  }
  chat: {
    has_history?: boolean
    max_messages?: number
    default_agent?: string
    welcome_message?: string
  }
}

export function useAuth() {
  const { data: session, status } = useSession()
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPermissions() {
      if (session?.user?.id) {
        try {
          const response = await fetch(`/api/auth/permissions?userId=${session.user.id}`)
          if (response.ok) {
            const perms = await response.json()
            setPermissions(perms)
          }
        } catch (error) {
          console.error("Erro ao carregar permissões:", error)
        } finally {
          setLoading(false)
        }
      } else if (status !== "loading") {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [session, status])

  const hasPermission = (permission: keyof UserPermissions["permissions"]): boolean => {
    return permissions?.permissions[permission] || false
  }

  const hasRole = (role: string): boolean => {
    return permissions?.user.role === role
  }

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.includes(permissions?.user.role || "")
  }

  const canPerformAction = async (action: string, resourceType?: string, currentCount?: number): Promise<boolean> => {
    if (!permissions) return false

    try {
      const response = await fetch("/api/auth/validate-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: permissions.user.id,
          action,
          resourceType,
          currentCount
        })
      })

      if (response.ok) {
        const result = await response.json()
        return result.allowed
      }
    } catch (error) {
      console.error("Erro ao validar ação:", error)
    }

    return false
  }

  return {
    session,
    permissions,
    loading: loading || status === "loading",
    isAuthenticated: !!session,
    hasPermission,
    hasRole,
    hasAnyRole,
    canPerformAction
  }
}