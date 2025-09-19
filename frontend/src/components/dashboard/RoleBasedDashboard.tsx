'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { User, MessageSquare, BarChart3, Settings, Crown, Shield } from 'lucide-react'

// Dashboards específicos por role
import RegularUserDashboard from './RegularUserDashboard'
import AdminDashboard from './AdminDashboard'
import SuperUserDashboard from './SuperUserDashboard'

export default function RoleBasedDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    setLoading(false)
  }, [session, status, router])

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'REGULAR':
        return {
          name: 'Usuário',
          description: 'Acesso ao chat e recursos básicos',
          icon: User,
          color: 'blue'
        }
      case 'ADMIN':
        return {
          name: 'Administrador',
          description: 'Gerenciamento do projeto e chat',
          icon: Crown,
          color: 'purple'
        }
      case 'SUPER_USER':
        return {
          name: 'Super Usuário',
          description: 'Acesso completo ao sistema',
          icon: Shield,
          color: 'red'
        }
      default:
        return {
          name: 'Usuário',
          description: 'Acesso básico',
          icon: User,
          color: 'gray'
        }
    }
  }

  const roleInfo = getRoleInfo(session.user.role)
  const RoleIcon = roleInfo.icon

  const renderDashboard = () => {
    switch (session.user.role) {
      case 'REGULAR':
        return <RegularUserDashboard />
      case 'ADMIN':
        return <AdminDashboard />
      case 'SUPER_USER':
        return <SuperUserDashboard />
      default:
        return <RegularUserDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with role indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${roleInfo.color}-100`}>
                <RoleIcon className={`w-6 h-6 text-${roleInfo.color}-600`} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {roleInfo.name}
                </h1>
                <p className="text-sm text-gray-600">
                  {roleInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {session.user.name}
                </p>
                <p className="text-xs text-gray-600">
                  {session.user.customer_name}
                </p>
              </div>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {session.user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard content based on role */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderDashboard()}
      </main>
    </div>
  )
}