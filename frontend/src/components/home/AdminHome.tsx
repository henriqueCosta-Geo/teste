'use client'

import CustomerDashboard from '@/components/admin/CustomerDashboard'

export default function AdminHome() {
  // TODO: Pegar customer_id do usuário logado dinamicamente
  // Por enquanto, usando customer_id fixo = 13
  return <CustomerDashboard customerId={13} />
}