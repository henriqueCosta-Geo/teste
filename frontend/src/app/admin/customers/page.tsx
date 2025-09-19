'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Building2, Users, Eye, Settings, TestTube } from 'lucide-react'
import { customersAPI } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { GridSkeleton, HeaderSkeleton } from '@/components/ui/skeleton'
import { PageLayout, PageLayoutSkeleton, EmptyState } from '@/components/layout/page-layout'
import { CustomerCard } from '@/components/ui/cards'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  // Memoize stats computations
  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter(c => c.is_active).length
  }), [customers])

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const data = await customersAPI.list()
      setCustomers(data)
    } catch (error) {
      console.error('Erro ao carregar customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Tem certeza que deseja deletar o customer "${name}"?`)) {
      try {
        await customersAPI.delete(id)
        await loadCustomers()
      } catch (error) {
        alert('Erro ao deletar customer')
      }
    }
  }

  const handleSimulate = async (customer: Customer) => {
    // Implementação da simulação será feita na próxima etapa
    console.log('Simular customer:', customer)
  }

  if (loading) {
    return <PageLayoutSkeleton />
  }

  return (
    <PageLayout
      title="Customers"
      subtitle="Gerencie clientes do sistema multi-tenant"
      stats={[
        { icon: <Building2 size={14} />, label: '', value: stats.total },
        { icon: <Users size={14} />, label: 'ativos', value: stats.active }
      ]}
      actions={
        <Link href="/admin/customers/create" className="btn-primary">
          <Plus size={16} />
          Novo Customer
        </Link>
      }
    >

      {/* Customers Grid */}
      {customers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {customers.map((customer, index) => (
            <div key={customer.id} className={`stagger-${Math.min(index % 4, 4)}`}>
              <CustomerCard
                customer={customer}
                onDelete={handleDelete}
                onSimulate={handleSimulate}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 size={64} />}
          title="Nenhum customer encontrado"
          description="Crie seu primeiro customer para começar a configurar o sistema multi-tenant"
          action={
            <Link href="/admin/customers/create" className="btn-primary">
              <Plus size={16} />
              Criar primeiro customer
            </Link>
          }
        />
      )}
    </PageLayout>
  )
}