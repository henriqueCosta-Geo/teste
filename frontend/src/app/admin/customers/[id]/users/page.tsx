'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Users, ArrowLeft, Mail, User, Shield, Calendar } from 'lucide-react'
import { PageLayout, PageLayoutSkeleton, EmptyState } from '@/components/layout/page-layout'

interface Customer {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  name: string
  email: string
  username: string
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

interface UsersResponse {
  customer: Customer
  users: User[]
}

export default function CustomerUsersPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = parseInt(params?.id as string)

  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'USER'
  })

  useEffect(() => {
    loadUsers()
  }, [customerId])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/customers/${customerId}/users`)

      if (!response.ok) {
        throw new Error('Erro ao carregar usuários')
      }

      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      alert('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newUser.name || !newUser.email || !newUser.username || !newUser.password) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    try {
      setCreating(true)
      const response = await fetch(`/api/admin/customers/${customerId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar usuário')
      }

      setNewUser({ name: '', email: '', username: '', password: '', role: 'USER' })
      setShowCreateForm(false)
      await loadUsers()
      alert('Usuário criado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error)
      alert(error.message || 'Erro ao criar usuário')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário "${userName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/customers/${customerId}/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Erro ao deletar usuário')
      }

      await loadUsers()
      alert('Usuário deletado com sucesso!')
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      alert('Erro ao deletar usuário')
    }
  }

  const getRoleBadge = (role: string) => {
    const styles = {
      SUPER_USER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      USER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      REGULAR: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
        {role}
      </span>
    )
  }

  if (loading) {
    return <PageLayoutSkeleton />
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }}>Erro ao carregar dados</p>
        <Link href="/admin/customers" className="btn-outline mt-4">
          Voltar para Customers
        </Link>
      </div>
    )
  }

  return (
    <PageLayout
      title={`Usuários - ${data.customer.name}`}
      subtitle={`Gerencie usuários do customer /${data.customer.slug}`}
      stats={[
        { icon: <Users size={14} />, label: '', value: data.users.length },
        {
          icon: <Shield size={14} />,
          label: 'ativos',
          value: data.users.filter(u => u.is_active).length
        }
      ]}
      actions={
        <div className="flex gap-2">
          <Link href="/admin/customers" className="btn-outline">
            <ArrowLeft size={16} />
            Voltar
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
          >
            <Plus size={16} />
            Novo Usuário
          </button>
        </div>
      }
    >
      {/* Create User Form */}
      {showCreateForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Criar Novo Usuário
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="input"
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="input"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Username *
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="input"
                  placeholder="username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Senha *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="input"
                >
                  <option value="USER">Regular User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="btn-primary"
              >
                {creating ? 'Criando...' : 'Criar Usuário'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-outline"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      {data.users.length > 0 ? (
        <div className="space-y-4">
          {data.users.map((user) => (
            <div key={user.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    user.is_active
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  }`}>
                    <User size={20} />
                  </div>

                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {user.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Mail size={14} />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <User size={14} />
                      @{user.username}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Role & Status */}
                  <div className="text-right">
                    {getRoleBadge(user.role)}
                    <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>

                  {/* Last Login */}
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Último login
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Nunca'
                      }
                    </div>
                  </div>

                  {/* Created */}
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Criado em
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="p-2 rounded hover:bg-red-50 text-red-500 hover:text-red-700 dark:hover:bg-red-900/20"
                    title="Deletar usuário"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={64} />}
          title="Nenhum usuário encontrado"
          description={`O customer "${data.customer.name}" ainda não possui usuários cadastrados`}
          action={
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              Criar primeiro usuário
            </button>
          }
        />
      )}
    </PageLayout>
  )
}