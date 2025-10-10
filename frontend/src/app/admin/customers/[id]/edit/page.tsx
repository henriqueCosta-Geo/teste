'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, AlertCircle, Save, Eye, FileText } from 'lucide-react'
import { customersAPI } from '@/lib/api'
import { AdvancedMetadataEditor } from '@/components/customers/AdvancedMetadataEditor'
import { MetadataPreview } from '@/components/customers/MetadataPreview'
import LogoUpload from '@/components/customers/LogoUpload'
import type { Customer } from '@/lib/types'

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = parseInt(params?.id as string)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [previewMode, setPreviewMode] = useState(false)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    metadata_toml: '',
    logo_path: '',
    is_active: true
  })

  // Carregar dados do customer
  useEffect(() => {
    loadCustomer()
  }, [customerId])

  const loadCustomer = async () => {
    try {
      setLoading(true)
      const data = await customersAPI.get(customerId)
      setCustomer(data)

      // Carregar metadados
      const metadata = await customersAPI.getMetadata(customerId)

      setFormData({
        name: data.name,
        slug: data.slug,
        description: '',
        metadata_toml: metadata.toml_content || '',
        logo_path: '',
        is_active: data.is_active
      })
    } catch (error) {
      console.error('Erro ao carregar customer:', error)
      setError('Erro ao carregar dados do customer')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      // Atualizar customer
      await customersAPI.update(customerId, {
        name: formData.name,
        slug: formData.slug
      })

      // Atualizar metadados
      if (formData.metadata_toml) {
        await customersAPI.updateMetadata(customerId, formData.metadata_toml)
      }

      setSuccess('Customer atualizado com sucesso!')

      // Recarregar dados
      await loadCustomer()

      // Voltar para a lista após 2 segundos
      setTimeout(() => {
        router.push('/admin/customers')
      }, 2000)
    } catch (error: any) {
      console.error('Erro ao atualizar customer:', error)
      setError(error.message || 'Erro ao atualizar customer')
    } finally {
      setSaving(false)
    }
  }

  const handleValidateToml = async () => {
    try {
      const result = await customersAPI.validateToml(formData.metadata_toml)

      if (result.valid) {
        setSuccess('✅ TOML válido!')
        setError('')
      } else {
        setError(`❌ Erros encontrados:\n${result.errors.join('\n')}`)
        setSuccess('')
      }

      if (result.warnings && result.warnings.length > 0) {
        console.warn('Avisos:', result.warnings)
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao validar TOML')
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Customer não encontrado</h3>
          <Link href="/admin/customers" className="mt-4 btn-primary inline-flex">
            Voltar para Customers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Voltar para Customers
        </Link>

        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-2xl">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Editar Customer
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {customer.name} (/{customer.slug})
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Erro</h3>
            <div className="mt-1 text-sm text-red-700 whitespace-pre-line">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <div className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5">✓</div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-800">Sucesso</h3>
            <p className="mt-1 text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Nome do Customer *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Slug (URL) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="input flex-1"
                    placeholder="acme-corp"
                  />
                </div>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Apenas letras minúsculas, números e hífens
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Status
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Customer ativo
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Logo do Customer
            </h2>
            <LogoUpload
              customerSlug={formData.slug}
              currentLogoPath={formData.logo_path}
              onLogoChange={(path) => setFormData({ ...formData, logo_path: path })}
            />
          </div>

          {/* Metadados TOML */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Metadados (TOML)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleValidateToml}
                  className="btn-secondary"
                  disabled={!formData.metadata_toml}
                >
                  <FileText size={16} />
                  Validar TOML
                </button>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="btn-outline"
                >
                  <Eye size={16} />
                  {previewMode ? 'Editar' : 'Preview'}
                </button>
              </div>
            </div>

            {previewMode ? (
              <MetadataPreview
                customerData={{
                  name: formData.name,
                  slug: formData.slug
                }}
                tomlContent={formData.metadata_toml}
              />
            ) : (
              <AdvancedMetadataEditor
                content={formData.metadata_toml}
                onChange={(content) => setFormData({ ...formData, metadata_toml: content })}
                customerSlug={formData.slug}
                logoPath={formData.logo_path}
              />
            )}
          </div>

          {/* Área de Metadados Salvos (Raw) */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Metadados Salvos (Atual)
            </h2>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {formData.metadata_toml || '# Nenhum metadado configurado'}
              </pre>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Estes são os metadados atualmente salvos no sistema
            </p>
          </div>
        </div>

        {/* Right Column - Info & Actions */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Informações do Customer
            </h3>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  ID
                </div>
                <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                  {customer.id}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Slug
                </div>
                <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                  /{customer.slug}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Status
                </div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  customer.is_active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {customer.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Criado em
                </div>
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {new Date(customer.created_at).toLocaleString('pt-BR')}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Atualizado em
                </div>
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {new Date(customer.updated_at).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Estatísticas
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Usuários
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {customer.users_count || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Agentes
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {customer.agents_count || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Coleções
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {customer.collections_count || 0}
                </div>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Storage
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  -
                </div>
              </div>
            </div>
          </div>

          {/* Metadata File Info */}
          {customer.metadata_file && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Arquivo de Metadados
              </h3>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                  Arquivo TOML
                </div>
                <div className="text-sm font-mono text-blue-800 dark:text-blue-300 break-all">
                  {customer.metadata_file}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Ações
            </h3>

            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.slug}
                className="btn-primary w-full justify-center"
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>

              <Link
                href={`/admin/customers/${customer.id}/users`}
                className="btn-secondary w-full justify-center"
              >
                Gerenciar Usuários
              </Link>

              <Link
                href={`/${customer.slug}/chat`}
                target="_blank"
                className="btn-outline w-full justify-center"
              >
                <Eye size={16} />
                Visualizar Chat
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
