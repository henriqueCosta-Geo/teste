import React, { useState, useEffect } from 'react'
import { X, TestTube, PlayCircle, CheckCircle, AlertCircle, Users, Bot, Database, MessageSquare, Eye, Settings } from 'lucide-react'

interface SimulationModalProps {
  isOpen: boolean
  onClose: () => void
  customerData: {
    name: string
    slug: string
    metadata_toml: string
  }
}

interface SimulationStep {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  duration?: number
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  customerData
}) => {
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<SimulationStep[]>([
    {
      id: 'metadata',
      name: 'Validar Metadados',
      icon: <Settings size={16} />,
      description: 'Verificando sintaxe e estrutura TOML',
      status: 'pending'
    },
    {
      id: 'limits',
      name: 'Verificar Limites',
      icon: <Database size={16} />,
      description: 'Validando limites do plano selecionado',
      status: 'pending'
    },
    {
      id: 'ui',
      name: 'Testar UI',
      icon: <Eye size={16} />,
      description: 'Simulando interface com configurações',
      status: 'pending'
    },
    {
      id: 'features',
      name: 'Verificar Features',
      icon: <Bot size={16} />,
      description: 'Testando recursos habilitados',
      status: 'pending'
    },
    {
      id: 'auth',
      name: 'Sistema de Auth',
      icon: <Users size={16} />,
      description: 'Simulando fluxo de autenticação',
      status: 'pending'
    },
    {
      id: 'integration',
      name: 'Integrações',
      icon: <MessageSquare size={16} />,
      description: 'Testando conectividade com serviços',
      status: 'pending'
    }
  ])

  const runSimulation = async () => {
    setIsRunning(true)
    setCurrentStep(0)

    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined })))

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i)

      // Update current step to running
      setSteps(prev => prev.map((step, index) =>
        index === i ? { ...step, status: 'running' } : step
      ))

      // Simulate step execution
      const success = await simulateStep(steps[i], customerData)

      // Update step result
      setSteps(prev => prev.map((step, index) =>
        index === i ? {
          ...step,
          status: success.status,
          message: success.message,
          duration: success.duration
        } : step
      ))

      // Wait between steps
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
  }

  const simulateStep = async (step: SimulationStep, data: any): Promise<{
    status: 'success' | 'error'
    message: string
    duration: number
  }> => {
    const startTime = Date.now()

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000))

    const duration = Date.now() - startTime

    switch (step.id) {
      case 'metadata':
        try {
          // Simulate TOML parsing
          if (!data.metadata_toml.trim()) {
            return {
              status: 'error',
              message: 'Metadados TOML estão vazios',
              duration
            }
          }

          if (!data.metadata_toml.includes('[ui]')) {
            return {
              status: 'error',
              message: 'Seção [ui] obrigatória não encontrada',
              duration
            }
          }

          return {
            status: 'success',
            message: 'Estrutura TOML válida e completa',
            duration
          }
        } catch (error) {
          return {
            status: 'error',
            message: 'Erro de sintaxe no TOML',
            duration
          }
        }

      case 'limits':
        // Extract limits from TOML metadata
        const maxUsersMatch = data.metadata_toml.match(/max_users\s*=\s*(-?\d+)/)
        const maxAgentsMatch = data.metadata_toml.match(/max_agents\s*=\s*(-?\d+)/)

        const maxUsers = maxUsersMatch ? parseInt(maxUsersMatch[1]) : 50
        const maxAgents = maxAgentsMatch ? parseInt(maxAgentsMatch[1]) : 20

        return {
          status: 'success',
          message: `Limites configurados: ${maxUsers === -1 ? '∞' : maxUsers} usuários, ${maxAgents === -1 ? '∞' : maxAgents} agentes`,
          duration
        }

      case 'ui':
        // Simulate UI rendering test
        const hasTheme = data.metadata_toml.includes('theme =')
        const hasColor = data.metadata_toml.includes('primary_color =')

        if (!hasTheme && !hasColor) {
          return {
            status: 'error',
            message: 'Configurações de UI incompletas',
            duration
          }
        }

        return {
          status: 'success',
          message: 'Interface renderizada com sucesso',
          duration
        }

      case 'features':
        // Count enabled features
        const features = ['agents', 'collections', 'teams', 'analytics']
        const enabledCount = features.filter(f =>
          data.metadata_toml.includes(`${f} = true`)
        ).length

        return {
          status: 'success',
          message: `${enabledCount} de ${features.length} recursos habilitados`,
          duration
        }

      case 'auth':
        // Simulate auth system test
        const hasOAuth = data.metadata_toml.includes('allowed_oauth')

        return {
          status: 'success',
          message: hasOAuth ? 'Sistema OAuth configurado' : 'Auth básico configurado',
          duration
        }

      case 'integration':
        // Simulate integration test
        const hasWebhook = data.metadata_toml.includes('webhook_url') &&
                           data.metadata_toml.includes('http')

        return {
          status: hasWebhook ? 'success' : 'success',
          message: hasWebhook ? 'Webhook configurado e testado' : 'Sem integrações externas',
          duration
        }

      default:
        return {
          status: 'success',
          message: 'Teste concluído',
          duration
        }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )
      case 'success':
        return <CheckCircle size={16} className="text-green-600" />
      case 'error':
        return <AlertCircle size={16} className="text-red-600" />
      default:
        return <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
    }
  }

  const allStepsCompleted = steps.every(step => step.status === 'success' || step.status === 'error')
  const hasErrors = steps.some(step => step.status === 'error')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <TestTube size={24} className="text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Simulação de Customer
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Testando "{customerData.name}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Customer Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Configurações do Teste
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Slug:</span>
                <span className="ml-2 font-mono">/{customerData.slug}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className="ml-2 font-semibold text-green-600">Ativo</span>
              </div>
            </div>
          </div>

          {/* Simulation Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  step.status === 'running'
                    ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20'
                    : step.status === 'success'
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                    : step.status === 'error'
                    ? 'border-red-200 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(step.status)}
                    {step.icon}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {step.name}
                      </h4>
                      {step.duration && (
                        <span className="text-xs text-gray-500">
                          {step.duration}ms
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {step.message || step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Results Summary */}
          {allStepsCompleted && (
            <div className={`mt-6 p-4 rounded-lg ${
              hasErrors
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {hasErrors ? (
                  <AlertCircle size={20} className="text-red-600" />
                ) : (
                  <CheckCircle size={20} className="text-green-600" />
                )}
                <h3 className={`font-semibold ${
                  hasErrors ? 'text-red-900 dark:text-red-200' : 'text-green-900 dark:text-green-200'
                }`}>
                  {hasErrors ? 'Simulação com Problemas' : 'Simulação Bem-sucedida'}
                </h3>
              </div>
              <p className={`text-sm ${
                hasErrors ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
              }`}>
                {hasErrors
                  ? 'Alguns testes falharam. Verifique as configurações antes de criar o customer.'
                  : 'Todos os testes passaram. O customer está pronto para ser criado.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {isRunning && (
              <>
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Executando teste {currentStep + 1} de {steps.length}...
                </span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-outline"
            >
              Fechar
            </button>

            {!isRunning && (
              <button
                onClick={runSimulation}
                className="btn-primary"
              >
                <PlayCircle size={16} />
                {allStepsCompleted ? 'Executar Novamente' : 'Iniciar Simulação'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}