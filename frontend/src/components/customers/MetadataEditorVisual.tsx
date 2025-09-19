'use client'

import React, { useState, useCallback } from 'react'
import { CustomerMetadata } from '@/lib/types'
import {
  Palette,
  MessageSquare,
  Settings,
  BarChart3,
  Save,
  Eye,
  Bot,
  Database,
  Users
} from 'lucide-react'

interface MetadataEditorVisualProps {
  initialMetadata?: CustomerMetadata
  onSave: (metadata: CustomerMetadata) => void
  onPreview: (metadata: CustomerMetadata) => void
}

export const MetadataEditorVisual: React.FC<MetadataEditorVisualProps> = ({
  initialMetadata = {},
  onSave,
  onPreview
}) => {
  const [metadata, setMetadata] = useState<CustomerMetadata>(initialMetadata)
  const [activeSection, setActiveSection] = useState('ui')

  const updateMetadata = useCallback((path: string, value: any) => {
    setMetadata(prev => {
      const newMetadata = { ...prev }
      const keys = path.split('.')
      let current: any = newMetadata

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = value
      return newMetadata
    })
  }, [])

  const sections = [
    { id: 'ui', label: 'Interface', icon: <Palette size={20} /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={20} /> },
    { id: 'features', label: 'Recursos', icon: <Settings size={20} /> },
    { id: 'limits', label: 'Limites', icon: <BarChart3 size={20} /> }
  ]

  const renderUISection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configurações de Interface</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tema
          </label>
          <select
            value={metadata.ui?.theme || 'light'}
            onChange={(e) => updateMetadata('ui.theme', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
            <option value="auto">Automático</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cor Primária
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={metadata.ui?.primary_color || '#3B82F6'}
              onChange={(e) => updateMetadata('ui.primary_color', e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              value={metadata.ui?.primary_color || '#3B82F6'}
              onChange={(e) => updateMetadata('ui.primary_color', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="#3B82F6"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Caminho do Logo
        </label>
        <input
          type="text"
          value={metadata.ui?.logo_path || ''}
          onChange={(e) => updateMetadata('ui.logo_path', e.target.value)}
          placeholder="/assets/logo.png"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="show_branding"
          checked={metadata.ui?.show_branding !== false}
          onChange={(e) => updateMetadata('ui.show_branding', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="show_branding" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Mostrar marca/branding do sistema
        </label>
      </div>
    </div>
  )

  const renderChatSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configurações de Chat</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Máximo de Mensagens
          </label>
          <input
            type="number"
            value={metadata.chat?.max_messages || 100}
            onChange={(e) => updateMetadata('chat.max_messages', parseInt(e.target.value))}
            min="1"
            max="1000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Agente Padrão
          </label>
          <input
            type="text"
            value={metadata.chat?.default_agent || ''}
            onChange={(e) => updateMetadata('chat.default_agent', e.target.value)}
            placeholder="Nome do agente padrão"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mensagem de Boas-vindas
        </label>
        <textarea
          value={metadata.chat?.welcome_message || ''}
          onChange={(e) => updateMetadata('chat.welcome_message', e.target.value)}
          placeholder="Olá! Como posso ajudá-lo hoje?"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="has_history"
          checked={metadata.chat?.has_history !== false}
          onChange={(e) => updateMetadata('chat.has_history', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="has_history" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Manter histórico de conversas
        </label>
      </div>
    </div>
  )

  const renderFeaturesSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recursos Habilitados</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'agents', label: 'Agentes', icon: <Bot size={16} />, description: 'Permitir criação e uso de agentes IA' },
          { key: 'collections', label: 'Coleções', icon: <Database size={16} />, description: 'Gerenciar documentos e bases de conhecimento' },
          { key: 'teams', label: 'Times', icon: <Users size={16} />, description: 'Criar times de agentes colaborativos' },
          { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} />, description: 'Visualizar métricas e performance' }
        ].map(feature => (
          <div key={feature.key} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                {feature.icon}
                <label className="font-medium text-gray-700 dark:text-gray-300">
                  {feature.label}
                </label>
              </div>
              <input
                type="checkbox"
                checked={metadata.features?.[feature.key as keyof typeof metadata.features] !== false}
                onChange={(e) => updateMetadata(`features.${feature.key}`, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <p className="text-sm text-gray-500">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderLimitsSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Limites e Cotas</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'max_users', label: 'Máximo de Usuários', defaultValue: 10, description: 'Número máximo de usuários permitidos' },
          { key: 'max_agents', label: 'Máximo de Agentes', defaultValue: 5, description: 'Número máximo de agentes por customer' },
          { key: 'max_collections', label: 'Máximo de Coleções', defaultValue: 10, description: 'Número máximo de coleções de documentos' },
          { key: 'storage_mb', label: 'Storage (MB)', defaultValue: 1000, description: 'Limite de armazenamento em megabytes' }
        ].map(limit => (
          <div key={limit.key} className="p-4 border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {limit.label}
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={metadata.limits?.[limit.key as keyof typeof metadata.limits] || limit.defaultValue}
                onChange={(e) => updateMetadata(`limits.${limit.key}`, parseInt(e.target.value))}
                min="-1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => updateMetadata(`limits.${limit.key}`, -1)}
                className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap"
              >
                Ilimitado
              </button>
            </div>
            <p className="text-xs text-gray-500">{limit.description} (-1 para ilimitado)</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSection = () => {
    switch (activeSection) {
      case 'ui':
        return renderUISection()
      case 'chat':
        return renderChatSection()
      case 'features':
        return renderFeaturesSection()
      case 'limits':
        return renderLimitsSection()
      default:
        return null
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Editor Visual de Metadados
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => onPreview(metadata)}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
          >
            <Eye size={16} />
            Preview
          </button>
          <button
            onClick={() => onSave(metadata)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Save size={16} />
            Salvar
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="w-64 border-r border-gray-200 dark:border-gray-700">
          <nav className="p-4 space-y-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 p-6">
          {renderSection()}
        </div>
      </div>
    </div>
  )
}