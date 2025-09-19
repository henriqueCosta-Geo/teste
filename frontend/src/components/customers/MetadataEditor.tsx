import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, FileText, Code, Eye, Settings } from 'lucide-react'

interface MetadataEditorProps {
  content: string
  onChange: (content: string) => void
  customerSlug: string
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({
  content,
  onChange,
  customerSlug
}) => {
  const [validation, setValidation] = useState<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }>({ isValid: true, errors: [], warnings: [] })

  const [activeSection, setActiveSection] = useState<string>('ui')

  useEffect(() => {
    validateToml(content)
  }, [content])

  const validateToml = (tomlContent: string) => {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Validações básicas de TOML
      if (!tomlContent.trim()) {
        errors.push('Conteúdo TOML não pode estar vazio')
        setValidation({ isValid: false, errors, warnings })
        return
      }

      // Verificar seções obrigatórias
      const requiredSections = ['ui', 'chat', 'features', 'limits']
      requiredSections.forEach(section => {
        if (!tomlContent.includes(`[${section}]`)) {
          warnings.push(`Seção [${section}] não encontrada - usando valores padrão`)
        }
      })

      // Verificar valores de limite
      if (tomlContent.includes('max_users = 0') || tomlContent.includes('max_agents = 0')) {
        warnings.push('Limite de 0 pode impedir criação de recursos')
      }

      // Verificar URLs
      const urlPattern = /webhook_url\s*=\s*"([^"]+)"/
      const urlMatch = tomlContent.match(urlPattern)
      if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('http')) {
        warnings.push('webhook_url deve começar com http:// ou https://')
      }

      setValidation({
        isValid: errors.length === 0,
        errors,
        warnings
      })
    } catch (error) {
      errors.push('Erro de sintaxe TOML')
      setValidation({ isValid: false, errors, warnings })
    }
  }

  const sections = [
    {
      id: 'ui',
      name: 'Interface',
      icon: <Eye size={16} />,
      description: 'Configurações visuais',
      template: `[ui]
theme = "light"
logo_path = "/logos/${customerSlug}-logo.png"
primary_color = "#3B82F6"
show_branding = true`
    },
    {
      id: 'chat',
      name: 'Chat',
      icon: <FileText size={16} />,
      description: 'Configurações de conversa',
      template: `[chat]
has_history = true
max_messages = 200
default_agent = "assistant"
welcome_message = "Olá! Como posso ajudar você hoje?"`
    },
    {
      id: 'features',
      name: 'Recursos',
      icon: <Settings size={16} />,
      description: 'Features habilitadas',
      template: `[features]
agents = true
collections = true
teams = true
analytics = true`
    },
    {
      id: 'limits',
      name: 'Limites',
      icon: <Code size={16} />,
      description: 'Limitações do plano',
      template: `[limits]
max_users = 50
max_agents = 20
max_collections = 100
storage_mb = 10240`
    }
  ]

  const insertSection = (sectionTemplate: string) => {
    const newContent = content + '\n\n' + sectionTemplate
    onChange(newContent)
  }

  const formatContent = () => {
    // Básico formatador de TOML
    const lines = content.split('\n')
    const formatted = lines.map(line => {
      if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
        return '\n' + line.trim()
      }
      return line
    }).join('\n')

    onChange(formatted.trim())
  }

  return (
    <div className="space-y-4">
      {/* Validation Status */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="space-y-2">
          {validation.errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          ))}
          {validation.warnings.map((warning, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              <AlertCircle size={16} />
              <span className="text-sm">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {validation.isValid && validation.errors.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle size={16} />
          <span className="text-sm">Configuração TOML válida</span>
        </div>
      )}

      {/* Section Quick Insert */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Inserir Seções Rápidas
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => insertSection(section.template)}
              className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                {section.icon}
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {section.name}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {section.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Configuração TOML
          </label>
          <button
            onClick={formatContent}
            className="btn-outline text-xs"
          >
            Formatar
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={20}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
          placeholder="# Configurações do Customer
[ui]
theme = &quot;light&quot;
primary_color = &quot;#3B82F6&quot;

[chat]
has_history = true
max_messages = 200

[features]
agents = true
collections = true

[limits]
max_users = 50
max_agents = 20"
        />
      </div>

      {/* Help */}
      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          💡 Dicas de Configuração
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Use <code>theme = "light"</code> ou <code>theme = "dark"</code></li>
          <li>• Cores devem estar em formato hex: <code>primary_color = "#3B82F6"</code></li>
          <li>• Limite -1 significa ilimitado: <code>max_users = -1</code></li>
          <li>• Storage em MB: <code>storage_mb = 10240</code> (10GB)</li>
          <li>• Arrays usam colchetes: <code>allowed_oauth = ["google", "github"]</code></li>
        </ul>
      </div>
    </div>
  )
}