import CustomerDashboard from '@/components/admin/CustomerDashboard'

interface PageProps {
  params: {
    customerId: string
  }
}

export default function AdminDashboardPage({ params }: PageProps) {
  const customerId = parseInt(params?.customerId, 10)

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <CustomerDashboard customerId={customerId} />
    </div>
  )
}
