import { DatabaseViewer } from '@/components/database/DatabaseViewer'

export default function DatabasePage() {
  return (
    <div className="min-h-screen">
      <DatabaseViewer />
    </div>
  )
}

export const metadata = {
  title: 'Database | Qdrant Admin',
  description: 'View and manage database tables and records',
}