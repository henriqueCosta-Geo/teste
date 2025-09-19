'use client'

import { useSession } from 'next-auth/react'
import SuperUserHome from './SuperUserHome'
import AdminHome from './AdminHome'
import RegularUserHome from './RegularUserHome'

export default function DynamicHome() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Carregando...
        </span>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Carregando...
        </span>
      </div>
    )
  }

  // Renderizar home baseado no role do usuário
  const userRole = session.user.role

  switch (userRole) {
    case 'SUPER_USER':
      return <SuperUserHome />
    case 'ADMIN':
      return <AdminHome />
    case 'REGULAR':
      return <RegularUserHome />
    default:
      return <RegularUserHome />
  }
}