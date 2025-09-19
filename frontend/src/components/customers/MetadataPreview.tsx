import React, { useMemo } from 'react'
import { Building2, Users, Bot, Database, Palette, MessageSquare, Settings, BarChart3, Crown, Zap, CheckCircle, XCircle } from 'lucide-react'

interface MetadataPreviewProps {
  customerData: {
    name: string
    slug: string
  }
  tomlContent: string
}

export const MetadataPreview: React.FC<MetadataPreviewProps> = ({
  customerData,
  tomlContent
}) => {
  const parsedMetadata = useMemo(() => {
    try {
      // Parser básico de TOML para preview
      const sections: any = {}
      let currentSection = ''

      const lines = tomlContent.split('\n')

      lines.forEach(line => {
        const trimmed = line.trim()

        // Detectar seção
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          currentSection = trimmed.slice(1, -1)
          sections[currentSection] = {}
          return
        }

        // Parsear propriedade
        if (trimmed.includes('=') && currentSection) {
          const [key, ...valueParts] = trimmed.split('=')
          const value = valueParts.join('=').trim()

          // Remover aspas
          let stringValue = value.replace(/^"(.*)"$/, '$1')
          let parsedValue: any = stringValue

          // Converter tipos
          if (stringValue === 'true') parsedValue = true
          else if (stringValue === 'false') parsedValue = false
          else if (!isNaN(Number(stringValue))) parsedValue = Number(stringValue)
          else if (stringValue.startsWith('[') && stringValue.endsWith(']')) {
            parsedValue = stringValue.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''))
          }

          sections[currentSection][key.trim()] = parsedValue
        }
      })

      return sections
    } catch (error) {
      return {}
    }
  }, [tomlContent])


  return (
    <div className="space-y-6">
      {/* Customer Header Preview */}
      <div className="card-modern border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <Building2 size={32} className="text-gray-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {customerData.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              /{customerData.slug}
            </p>
          </div>
        </div>
      </div>

      {/* UI Configuration Preview */}
      {parsedMetadata.ui && (
        <div className="card-modern">
          <div className="flex items-center gap-3 mb-4">
            <Palette size={24} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configurações de Interface
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tema</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {parsedMetadata.ui.theme || 'light'}
              </div>
            </div>

            {parsedMetadata.ui.primary_color && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cor Primária</div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: parsedMetadata.ui.primary_color }}
                  />
                  <span className="font-mono text-sm">{parsedMetadata.ui.primary_color}</span>
                </div>
              </div>
            )}

            {parsedMetadata.ui.logo_path && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Logo</div>
                <div className="font-mono text-sm text-gray-900 dark:text-white">
                  {parsedMetadata.ui.logo_path}
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Branding</div>
              <div className="flex items-center gap-2">
                {parsedMetadata.ui.show_branding ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
                <span className="text-sm">
                  {parsedMetadata.ui.show_branding ? 'Ativado' : 'Desativado'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Configuration Preview */}
      {parsedMetadata.chat && (
        <div className="card-modern">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare size={24} className="text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configurações de Chat
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Histórico</div>
              <div className="flex items-center gap-2">
                {parsedMetadata.chat.has_history ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-red-600" />
                )}
                <span className="text-sm">
                  {parsedMetadata.chat.has_history ? 'Ativado' : 'Desativado'}
                </span>
              </div>
            </div>

            {parsedMetadata.chat.max_messages && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Max Mensagens</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {parsedMetadata.chat.max_messages}
                </div>
              </div>
            )}

            {parsedMetadata.chat.default_agent && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Agente Padrão</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {parsedMetadata.chat.default_agent}
                </div>
              </div>
            )}
          </div>

          {parsedMetadata.chat.welcome_message && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Mensagem de Boas-vindas</div>
              <div className="text-blue-900 dark:text-blue-200">
                "{parsedMetadata.chat.welcome_message}"
              </div>
            </div>
          )}
        </div>
      )}

      {/* Features Preview */}
      {parsedMetadata.features && (
        <div className="card-modern">
          <div className="flex items-center gap-3 mb-4">
            <Settings size={24} className="text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recursos Habilitados
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'agents', label: 'Agentes', icon: <Bot size={20} /> },
              { key: 'collections', label: 'Coleções', icon: <Database size={20} /> },
              { key: 'teams', label: 'Teams', icon: <Users size={20} /> },
              { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> }
            ].map(feature => (
              <div key={feature.key} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  {feature.icon}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {feature.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {parsedMetadata.features[feature.key] ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-red-600" />
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {parsedMetadata.features[feature.key] ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Limits Preview */}
      {parsedMetadata.limits && (
        <div className="card-modern">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={24} className="text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Limites e Cotas
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'max_users', label: 'Usuários', icon: <Users size={16} /> },
              { key: 'max_agents', label: 'Agentes', icon: <Bot size={16} /> },
              { key: 'max_collections', label: 'Coleções', icon: <Database size={16} /> },
              { key: 'storage_mb', label: 'Storage (MB)', icon: <BarChart3 size={16} /> }
            ].map(limit => (
              <div key={limit.key} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {limit.icon}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {limit.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {parsedMetadata.limits[limit.key] === -1
                    ? '∞'
                    : (parsedMetadata.limits[limit.key] || '0')
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integration Preview */}
      {parsedMetadata.integrations && (
        <div className="card-modern">
          <div className="flex items-center gap-3 mb-4">
            <Settings size={24} className="text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Integrações
            </h3>
          </div>

          {parsedMetadata.integrations.allowed_oauth && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">OAuth Permitidos</div>
              <div className="flex flex-wrap gap-2">
                {parsedMetadata.integrations.allowed_oauth.map((provider: string, index: number) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                    {provider}
                  </span>
                ))}
              </div>
            </div>
          )}

          {parsedMetadata.integrations.webhook_url && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Webhook URL</div>
              <div className="font-mono text-sm text-gray-900 dark:text-white">
                {parsedMetadata.integrations.webhook_url}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}