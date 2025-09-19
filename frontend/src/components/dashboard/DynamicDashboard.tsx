'use client'

import { useSession } from 'next-auth/react'
import SuperUserDashboard from './SuperUserDashboard'
import AdminDashboard from './AdminDashboard'
import RegularUserDashboard from './RegularUserDashboard'

export default function DynamicDashboard() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Carregando dashboard...
        </span>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p style={{ color: 'var(--text-secondary)' }}>
          Acesso não autorizado
        </p>
      </div>
    )
  }

  // Renderizar dashboard baseado no role do usuário
  const userRole = session.user.role

  switch (userRole) {
    case 'SUPER_USER':
      return <SuperUserDashboard />
    case 'ADMIN':
      return <AdminDashboard />
    case 'REGULAR':
      return <RegularUserDashboard />
    default:
      return <RegularUserDashboard />
  }
}