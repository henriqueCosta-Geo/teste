'use client'

import React, { useState, useEffect } from 'react'
import { Palette, MessageSquare, Zap, BarChart3, Settings, Users, Code, Eye, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface MetadataConfig {
  ui: {
    theme: 'light' | 'dark' | 'auto'
    logo_path: string
    primary_color: string
    show_branding: boolean
  }
  chat: {
    has_history: boolean
    max_messages: number
    default_agent: string
    default_team: string
    welcome_message: string
  }
  features: {
    agents: boolean
    collections: boolean
    teams: boolean
    analytics: boolean
  }
  limits: {
    max_users: number
    max_agents: number
    max_collections: number
    storage_mb: number
  }
  integrations: {
    allowed_oauth: string[]
    webhook_url: string
  }
}

interface AdvancedMetadataEditorProps {
  content: string
  onChange: (content: string) => void
  customerSlug: string
  logoPath?: string
}

export const AdvancedMetadataEditor: React.FC<AdvancedMetadataEditorProps> = ({
  content,
  onChange,
  customerSlug,
  logoPath
}) => {
  const [config, setConfig] = useState<MetadataConfig>({
    ui: {
      theme: 'light',
      logo_path: `/logos/${customerSlug}-logo.png`,
      primary_color: '#3B82F6',
      show_branding: true
    },
    chat: {
      has_history: true,
      max_messages: 100,
      default_agent: '',
      default_team: '',
      welcome_message: 'Olá! Como posso ajudar você hoje?'
    },
    features: {
      agents: true,
      collections: true,
      teams: true,
      analytics: true
    },
    limits: {
      max_users: 50,
      max_agents: 20,
      max_collections: 100,
      storage_mb: 10240
    },
    integrations: {
      allowed_oauth: ['google', 'microsoft', 'github'],
      webhook_url: ''
    }
  })

  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual')
  const [activeSection, setActiveSection] = useState<'ui' | 'chat' | 'features' | 'limits' | 'integrations'>('ui')
  const [agents, setAgents] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Parse existing TOML content ONLY on first load
  useEffect(() => {
    if (content && !isInitialized) {
      parseTomlToConfig(content)
      setIsInitialized(true)
    }
  }, [content, isInitialized])

  // Sync logo path from parent
  useEffect(() => {
    if (logoPath && logoPath !== config.ui.logo_path) {
      setConfig(prev => ({
        ...prev,
        ui: { ...prev.ui, logo_path: logoPath }
      }))
    }
  }, [logoPath])

  // Generate TOML when config changes
  useEffect(() => {
    const tomlContent = generateTomlFromConfig(config)
    onChange(tomlContent)
  }, [config, onChange])

  // Fetch agents and teams
  useEffect(() => {
    fetchAgents()
    fetchTeams()
  }, [])

  const fetchAgents = async () => {
    setLoadingAgents(true)
    try {
      const response = await fetch('/api/agents')
      if (response.ok) {
        const data = await response.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Erro ao buscar agentes:', error)
    } finally {
      setLoadingAgents(false)
    }
  }

  const fetchTeams = async () => {
    setLoadingTeams(true)
    try {
      const response = await fetch('/api/teams')
      if (response.ok) {
        const data = await response.json()
        setTeams(data)
      }
    } catch (error) {
      console.error('Erro ao buscar times:', error)
    } finally {
      setLoadingTeams(false)
    }
  }

  const parseTomlToConfig = (tomlContent: string) => {
    try {
      const newConfig = { ...config }

      // Parse theme
      const themeMatch = tomlContent.match(/theme\\s*=\\s*"([^"]*)"/)
      if (themeMatch) newConfig.ui.theme = themeMatch[1] as any

      // Parse logo_path
      const logoMatch = tomlContent.match(/logo_path\\s*=\\s*"([^"]*)"/)
      if (logoMatch) newConfig.ui.logo_path = logoMatch[1]

      // Parse primary_color
      const colorMatch = tomlContent.match(/primary_color\\s*=\\s*"([^"]*)"/)
      if (colorMatch) newConfig.ui.primary_color = colorMatch[1]

      // Parse boolean features
      const agentsMatch = tomlContent.match(/agents\\s*=\\s*(true|false)/)
      if (agentsMatch) newConfig.features.agents = agentsMatch[1] === 'true'

      const collectionsMatch = tomlContent.match(/collections\\s*=\\s*(true|false)/)
      if (collectionsMatch) newConfig.features.collections = collectionsMatch[1] === 'true'

      // Parse limits
      const maxUsersMatch = tomlContent.match(/max_users\\s*=\\s*(\\d+)/)
      if (maxUsersMatch) newConfig.limits.max_users = parseInt(maxUsersMatch[1])

      const maxAgentsMatch = tomlContent.match(/max_agents\\s*=\\s*(\\d+)/)
      if (maxAgentsMatch) newConfig.limits.max_agents = parseInt(maxAgentsMatch[1])

      // Parse chat settings
      const defaultAgentMatch = tomlContent.match(/default_agent\\s*=\\s*"([^"]*)"/)
      if (defaultAgentMatch) newConfig.chat.default_agent = defaultAgentMatch[1]

      const defaultTeamMatch = tomlContent.match(/default_team\\s*=\\s*"([^"]*)"/)
      if (defaultTeamMatch) newConfig.chat.default_team = defaultTeamMatch[1]

      const welcomeMessageMatch = tomlContent.match(/welcome_message\\s*=\\s*"([^"]*)"/)
      if (welcomeMessageMatch) newConfig.chat.welcome_message = welcomeMessageMatch[1]

      setConfig(newConfig)
    } catch (error) {
      console.error('Error parsing TOML:', error)
    }
  }

  const generateTomlFromConfig = (config: MetadataConfig): string => {
    return `# Configurações de UI/Interface
[ui]
theme = "${config.ui.theme}"
logo_path = "${config.ui.logo_path}"
primary_color = "${config.ui.primary_color}"
show_branding = ${config.ui.show_branding}

# Configurações de Chat
[chat]
has_history = ${config.chat.has_history}
max_messages = ${config.chat.max_messages}
default_agent = "${config.chat.default_agent}"
default_team = "${config.chat.default_team}"
welcome_message = "${config.chat.welcome_message}"

# Recursos habilitados
[features]
agents = ${config.features.agents}
collections = ${config.features.collections}
teams = ${config.features.teams}
analytics = ${config.features.analytics}

# Limites padrão
[limits]
max_users = ${config.limits.max_users}
max_agents = ${config.limits.max_agents}
max_collections = ${config.limits.max_collections}
storage_mb = ${config.limits.storage_mb}

# Integrações permitidas
[integrations]
allowed_oauth = [${config.integrations.allowed_oauth.map(o => `"${o}"`).join(', ')}]
webhook_url = "${config.integrations.webhook_url}"`
  }

  const updateConfig = (section: keyof MetadataConfig, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  const toggleFeature = (feature: keyof MetadataConfig['features']) => {
    setConfig(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features[feature]
      }
    }))
  }

  const sections = [
    { id: 'ui', label: 'Interface', icon: Palette, color: 'blue' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'green' },
    { id: 'features', label: 'Recursos', icon: Zap, color: 'purple' },
    { id: 'limits', label: 'Limites', icon: BarChart3, color: 'orange' },
    { id: 'integrations', label: 'Integrações', icon: Settings, color: 'gray' }
  ]

  const renderVisualEditor = () => {
    switch (activeSection) {
      case 'ui':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tema
                </label>
                <select
                  value={config.ui.theme}
                  onChange={(e) => updateConfig('ui', 'theme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                  <option value="auto">Automático</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cor Primária
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.ui.primary_color}
                    onChange={(e) => updateConfig('ui', 'primary_color', e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.ui.primary_color}
                    onChange={(e) => updateConfig('ui', 'primary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caminho do Logo
                </label>
                <input
                  type="text"
                  value={config.ui.logo_path}
                  onChange={(e) => updateConfig('ui', 'logo_path', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/logos/logo.png"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.ui.show_branding}
                    onChange={(e) => updateConfig('ui', 'show_branding', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Mostrar marca
                  </span>
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
              <div
                className="p-4 rounded-lg text-white"
                style={{ backgroundColor: config.ui.primary_color }}
              >
                <div className="flex items-center gap-2">
                  {config.ui.show_branding && (
                    <div className="w-8 h-8 bg-white bg-opacity-20 rounded" />
                  )}
                  <span className="font-semibold">Customer Portal</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'chat':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.chat.has_history}
                    onChange={(e) => updateConfig('chat', 'has_history', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Manter histórico de conversas
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de mensagens
                </label>
                <input
                  type="number"
                  value={config.chat.max_messages}
                  onChange={(e) => updateConfig('chat', 'max_messages', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="1000"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  🤖 Tipo de Atendimento Padrão
                </label>
                <div className="space-y-4">
                  {/* Radio buttons para escolher o tipo */}
                  <div className="flex gap-6">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="chat_type"
                        value="agent"
                        checked={!!config.chat.default_agent && !config.chat.default_team}
                        onChange={() => {
                          updateConfig('chat', 'default_team', '')
                          if (!config.chat.default_agent && agents.length > 0) {
                            updateConfig('chat', 'default_agent', agents[0].name)
                          }
                        }}
                        className="mr-2"
                      />
                      <span>Agente Individual</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="chat_type"
                        value="team"
                        checked={!!config.chat.default_team && !config.chat.default_agent}
                        onChange={() => {
                          updateConfig('chat', 'default_agent', '')
                          if (!config.chat.default_team && teams.length > 0) {
                            updateConfig('chat', 'default_team', teams[0].name)
                          }
                        }}
                        className="mr-2"
                      />
                      <span>Time de Agentes</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="chat_type"
                        value="none"
                        checked={!config.chat.default_agent && !config.chat.default_team}
                        onChange={() => {
                          updateConfig('chat', 'default_agent', '')
                          updateConfig('chat', 'default_team', '')
                        }}
                        className="mr-2"
                      />
                      <span>Busca Livre</span>
                    </label>
                  </div>

                  {/* Seletor de Agente (aparece apenas se "Agente Individual" está selecionado) */}
                  {!!config.chat.default_agent && !config.chat.default_team && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Selecionar Agente
                      </label>
                      <select
                        value={config.chat.default_agent}
                        onChange={(e) => updateConfig('chat', 'default_agent', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loadingAgents}
                      >
                        <option value="">Selecione um agente</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.name}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                      {loadingAgents && (
                        <p className="text-sm text-gray-500 mt-1">Carregando agentes...</p>
                      )}
                    </div>
                  )}

                  {/* Seletor de Time (aparece apenas se "Time de Agentes" está selecionado) */}
                  {!!config.chat.default_team && !config.chat.default_agent && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Selecionar Time
                      </label>
                      <select
                        value={config.chat.default_team}
                        onChange={(e) => updateConfig('chat', 'default_team', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loadingTeams}
                      >
                        <option value="">Selecione um time</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.name}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      {loadingTeams && (
                        <p className="text-sm text-gray-500 mt-1">Carregando times...</p>
                      )}
                    </div>
                  )}

                  {/* Explicação para Busca Livre */}
                  {!config.chat.default_agent && !config.chat.default_team && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-700">
                        💡 Usuários poderão escolher livremente entre agentes, times ou fazer buscas diretas na base de conhecimento.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem de boas-vindas
                </label>
                <textarea
                  value={config.chat.welcome_message}
                  onChange={(e) => updateConfig('chat', 'welcome_message', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Olá! Como posso ajudar você hoje?"
                />
              </div>
            </div>
          </div>
        )

      case 'features':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(config.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">{feature}</h4>
                    <p className="text-sm text-gray-600">
                      {feature === 'agents' && 'Permite criar e gerenciar agentes de IA'}
                      {feature === 'collections' && 'Acesso ao sistema de coleções de documentos'}
                      {feature === 'teams' && 'Funcionalidades de equipes e colaboração'}
                      {feature === 'analytics' && 'Relatórios e análises de uso'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFeature(feature as keyof MetadataConfig['features'])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )

      case 'limits':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de usuários
                </label>
                <input
                  type="number"
                  value={config.limits.max_users}
                  onChange={(e) => updateConfig('limits', 'max_users', parseInt(e.target.value) || -1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 para ilimitado"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 para ilimitado</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de agentes
                </label>
                <input
                  type="number"
                  value={config.limits.max_agents}
                  onChange={(e) => updateConfig('limits', 'max_agents', parseInt(e.target.value) || -1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 para ilimitado"
                />
                <p className="text-xs text-gray-500 mt-1">Use -1 para ilimitado</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de coleções
                </label>
                <input
                  type="number"
                  value={config.limits.max_collections}
                  onChange={(e) => updateConfig('limits', 'max_collections', parseInt(e.target.value) || -1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 para ilimitado"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Armazenamento (MB)
                </label>
                <input
                  type="number"
                  value={config.limits.storage_mb}
                  onChange={(e) => updateConfig('limits', 'storage_mb', parseInt(e.target.value) || -1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-1 para ilimitado"
                />
              </div>
            </div>

            {/* Limits preview */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Resumo dos Limites</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Usuários:</span>
                  <span className="ml-1 font-medium">{config.limits.max_users === -1 ? '∞' : config.limits.max_users}</span>
                </div>
                <div>
                  <span className="text-blue-700">Agentes:</span>
                  <span className="ml-1 font-medium">{config.limits.max_agents === -1 ? '∞' : config.limits.max_agents}</span>
                </div>
                <div>
                  <span className="text-blue-700">Coleções:</span>
                  <span className="ml-1 font-medium">{config.limits.max_collections === -1 ? '∞' : config.limits.max_collections}</span>
                </div>
                <div>
                  <span className="text-blue-700">Storage:</span>
                  <span className="ml-1 font-medium">{config.limits.storage_mb === -1 ? '∞' : `${config.limits.storage_mb}MB`}</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'integrations':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provedores OAuth permitidos
              </label>
              <div className="space-y-2">
                {['google', 'microsoft', 'github', 'discord', 'slack'].map(provider => (
                  <label key={provider} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.integrations.allowed_oauth.includes(provider)}
                      onChange={(e) => {
                        const newOAuth = e.target.checked
                          ? [...config.integrations.allowed_oauth, provider]
                          : config.integrations.allowed_oauth.filter(p => p !== provider)
                        updateConfig('integrations', 'allowed_oauth', newOAuth)
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm capitalize">{provider}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL do Webhook
              </label>
              <input
                type="url"
                value={config.integrations.webhook_url}
                onChange={(e) => updateConfig('integrations', 'webhook_url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/webhook"
              />
              <p className="text-xs text-gray-500 mt-1">URL para receber notificações de eventos</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Configuração de Metadados</h3>
          <div className="flex rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'visual'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-1" />
              Visual
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'code'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Code className="w-4 h-4 inline mr-1" />
              Código
            </button>
          </div>
        </div>

        {activeTab === 'visual' && (
          <div className="flex space-x-1">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeSection === section.id
                      ? `bg-${section.color}-100 text-${section.color}-700`
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {section.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'visual' ? (
          renderVisualEditor()
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código TOML
            </label>
            <textarea
              value={content}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="Digite seu código TOML aqui..."
            />
          </div>
        )}
      </div>
    </div>
  )
}