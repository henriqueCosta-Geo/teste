'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AdminDashboardRedirect() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    // Redirecionar para o dashboard do customer do usuário logado
    const customerId = session.user.customer_id

    console.log('🔄 [DASHBOARD-REDIRECT] Redirecionando para customer:', customerId)
    router.push(`/admin/dashboard/${customerId}`)
  }, [session, status, router])

  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="loading"></div>
      <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
        Redirecionando para seu dashboard...
      </span>
    </div>
  )
}
