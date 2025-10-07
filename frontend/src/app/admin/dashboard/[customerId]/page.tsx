import CustomerDashboard from '@/components/admin/CustomerDashboard'

interface PageProps {
  params: {
    customerId: string
  }
}

export default function AdminDashboardPage({ params }: PageProps) {
  const customerId = parseInt(params.customerId, 10)

  return (
    <div className="container mx-auto px-4 py-8">
      <CustomerDashboard customerId={customerId} />
    </div>
  )
}
