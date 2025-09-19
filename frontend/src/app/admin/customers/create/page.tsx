'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, AlertCircle, FileText, User, TestTube, Eye } from 'lucide-react'
import { customersAPI } from '@/lib/api'
import { AdvancedMetadataEditor } from '@/components/customers/AdvancedMetadataEditor'
import { MetadataPreview } from '@/components/customers/MetadataPreview'
import { SimulationModal } from '@/components/customers/SimulationModal'
import LogoUpload from '@/components/customers/LogoUpload'

export default function CreateCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [previewMode, setPreviewMode] = useState(false)
  const [showSimulation, setShowSimulation] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    metadata_toml: '',
    logo_path: '',
    create_admin: true,
    admin_name: '',
    admin_email: '',
    admin_username: '',
    admin_password: ''
  })

  // Auto-gerar slug baseado no nome
  useEffect(() => {
    if (formData.name && step === 1) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }, [formData.name, step])

  const generateTomlTemplate = () => {
    const template = `# Configurações de UI/Interface
[ui]
theme = "light"
logo_path = "${formData.logo_path || `/logos/${formData.slug}-logo.png`}"
primary_color = "#3B82F6"
show_branding = true

# Configurações de Chat
[chat]
has_history = true
max_messages = 100
default_agent = "assistant"
welcome_message = "Olá! Como posso ajudar você hoje?"

# Recursos habilitados
[features]
agents = true
collections = true
teams = true
analytics = true

# Limites padrão
[limits]
max_users = 50
max_agents = 20
max_collections = 100
storage_mb = 10240

# Integrações permitidas
[integrations]
allowed_oauth = ["google", "microsoft", "github"]
webhook_url = ""`

    setFormData(prev => ({ ...prev, metadata_toml: template }))
  }

  // Gerar template TOML padrão
  useEffect(() => {
    if (step === 2 && !formData.metadata_toml) {
      generateTomlTemplate()
    }
  }, [step, formData.slug, formData.logo_path, formData.metadata_toml])

  const validateStep = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return formData.name.trim() && formData.slug.trim()
      case 2:
        return formData.metadata_toml.trim()
      case 3:
        return !formData.create_admin || (
          formData.admin_name.trim() &&
          formData.admin_email.trim() &&
          formData.admin_username.trim() &&
          formData.admin_password.trim()
        )
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3))
    } else {
      setError('Preencha todos os campos obrigatórios')
    }
  }

  const handlePrev = () => {
    setStep(prev => Math.max(prev - 1, 1))
    setError('')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      // Atualizar TOML com logo_path se necessário
      let tomlContent = formData.metadata_toml
      if (formData.logo_path) {
        tomlContent = tomlContent.replace(
          /logo_path = ".*"/,
          `logo_path = "${formData.logo_path}"`
        )
      }

      const customerData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        metadata_toml: tomlContent,
        create_admin: formData.create_admin,
        admin_data: formData.create_admin ? {
          name: formData.admin_name.trim(),
          email: formData.admin_email.trim(),
          username: formData.admin_username.trim(),
          password: formData.admin_password
        } : undefined
      }

      const result = await customersAPI.create(customerData)
      router.push('/admin/customers')
    } catch (error: any) {
      setError(error.message || 'Erro ao criar customer')
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    if (previewMode) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Preview do Customer</h3>
            <button
              onClick={() => setPreviewMode(false)}
              className="btn-outline"
            >
              <ArrowLeft size={16} />
              Voltar para edição
            </button>
          </div>
          <MetadataPreview
            customerData={formData}
            tomlContent={formData.metadata_toml}
          />
        </div>
      )
    }

    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Informações Básicas</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Customer *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Empresa Demo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                  Slug (URL) *
                </label>
                <input
                  type="text"
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="empresa-demo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usado na URL: /{formData.slug}
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva este customer..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Upload de Logo */}
            <div className="border-t pt-4">
              <LogoUpload
                customerSlug={formData.slug}
                currentLogoPath={formData.logo_path}
                onLogoChange={(logoPath) => {
                  setFormData(prev => ({ ...prev, logo_path: logoPath }))
                }}
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Configuração de Metadados</h3>
              <button
                onClick={() => setPreviewMode(true)}
                className="btn-secondary"
              >
                <Eye size={16} />
                Preview
              </button>
            </div>
            <AdvancedMetadataEditor
              content={formData.metadata_toml}
              onChange={(content) => setFormData(prev => ({ ...prev, metadata_toml: content }))}
              customerSlug={formData.slug}
              logoPath={formData.logo_path}
            />
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Usuário Admin Inicial</h3>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.create_admin}
                  onChange={(e) => setFormData(prev => ({ ...prev, create_admin: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Criar usuário administrador inicial
                </span>
              </label>
            </div>

            {formData.create_admin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label htmlFor="admin_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    id="admin_name"
                    value={formData.admin_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_name: e.target.value }))}
                    placeholder="Administrador"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="admin_email"
                    value={formData.admin_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
                    placeholder="admin@exemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="admin_username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    id="admin_username"
                    value={formData.admin_username}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_username: e.target.value }))}
                    placeholder="admin"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="admin_password" className="block text-sm font-medium text-gray-700 mb-2">
                    Senha *
                  </label>
                  <input
                    type="password"
                    id="admin_password"
                    value={formData.admin_password}
                    onChange={(e) => setFormData(prev => ({ ...prev, admin_password: e.target.value }))}
                    placeholder="Senha forte"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/customers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Customer</h1>
          <p className="text-gray-600">Configure um novo cliente no sistema multi-tenant</p>
        </div>
      </div>

      {/* Progress Steps */}
      {!previewMode && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Básico', icon: <Building2 size={16} /> },
              { num: 2, label: 'Metadados', icon: <FileText size={16} /> },
              { num: 3, label: 'Admin', icon: <User size={16} /> }
            ].map((stepInfo, index) => (
              <div key={stepInfo.num} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-medium text-sm ${
                    step >= stepInfo.num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {stepInfo.icon}
                </div>
                <div className="ml-2">
                  <div className={`text-sm font-medium ${
                    step >= stepInfo.num ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {stepInfo.label}
                  </div>
                </div>
                {index < 2 && (
                  <div className={`w-12 h-1 mx-4 rounded ${
                    step > stepInfo.num ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="card">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {renderStep()}

        {/* Navigation */}
        {!previewMode && (
          <div className="flex gap-4 pt-6 border-t mt-6">
            {step > 1 && (
              <button
                onClick={handlePrev}
                className="btn-outline"
              >
                Anterior
              </button>
            )}

            <div className="flex-1" />

            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={!validateStep(step)}
                className="btn-primary"
              >
                Próximo
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSimulation(true)}
                  className="btn-secondary"
                >
                  <TestTube size={16} />
                  Testar Preview
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !validateStep(step)}
                  className="btn-primary"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Criando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Building2 size={16} />
                      Criar Customer
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simulation Modal */}
      <SimulationModal
        isOpen={showSimulation}
        onClose={() => setShowSimulation(false)}
        customerData={{
          name: formData.name,
          slug: formData.slug,
          metadata_toml: formData.metadata_toml
        }}
      />
    </div>
  )
}