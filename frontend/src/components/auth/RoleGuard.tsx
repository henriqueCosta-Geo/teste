'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RoleGuardProps {
  allowedRoles: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

export default function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
  redirectTo = '/'
}: RoleGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Ainda carregando

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!allowedRoles.includes(session.user?.role || '')) {
      router.push(redirectTo)
      return
    }
  }, [session, status, allowedRoles, redirectTo, router])

  // Ainda carregando
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Verificando permissões...
        </span>
      </div>
    )
  }

  // Não autenticado
  if (!session) {
    return fallback
  }

  // Não tem permissão
  if (!allowedRoles.includes(session.user?.role || '')) {
    return fallback || (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Acesso Negado
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Você não tem permissão para acessar esta página.
          </p>
          <button
            onClick={() => router.push(redirectTo)}
            className="btn-primary mt-4"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  // Tem permissão
  return <>{children}</>
}