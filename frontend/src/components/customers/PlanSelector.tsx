import React from 'react'
import { Crown, Zap, Building2, Check, Users, Database, Bot, BarChart3 } from 'lucide-react'

interface PlanSelectorProps {
  selectedPlan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
  onSelectPlan: (plan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE') => void
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({ selectedPlan, onSelectPlan }) => {
  const plans = [
    {
      id: 'BASIC' as const,
      name: 'Basic',
      icon: <Building2 size={24} className="text-green-600" />,
      price: 'Gratuito',
      description: 'Ideal para começar',
      color: 'green',
      features: [
        '10 usuários',
        '5 agentes IA',
        '10 coleções',
        '1GB de storage',
        'Suporte básico'
      ],
      limits: {
        users: 10,
        agents: 5,
        collections: 10,
        storage: '1GB'
      }
    },
    {
      id: 'PROFESSIONAL' as const,
      name: 'Professional',
      icon: <Zap size={24} className="text-blue-600" />,
      price: '$99/mês',
      description: 'Para equipes em crescimento',
      color: 'blue',
      popular: true,
      features: [
        '50 usuários',
        '20 agentes IA',
        '100 coleções',
        '10GB de storage',
        'Teams & analytics',
        'Integrações OAuth',
        'Suporte prioritário'
      ],
      limits: {
        users: 50,
        agents: 20,
        collections: 100,
        storage: '10GB'
      }
    },
    {
      id: 'ENTERPRISE' as const,
      name: 'Enterprise',
      icon: <Crown size={24} className="text-purple-600" />,
      price: 'Customizado',
      description: 'Para grandes organizações',
      color: 'purple',
      features: [
        'Usuários ilimitados',
        'Agentes ilimitados',
        'Coleções ilimitadas',
        '50GB+ de storage',
        'SAML/LDAP',
        'Webhooks customizados',
        'Suporte dedicado',
        'SLA garantido'
      ],
      limits: {
        users: '∞',
        agents: '∞',
        collections: '∞',
        storage: '50GB+'
      }
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`relative cursor-pointer transition-all duration-200 ${
            selectedPlan === plan.id
              ? 'ring-2 ring-blue-500 transform scale-105'
              : 'hover:shadow-lg hover:transform hover:scale-102'
          }`}
          onClick={() => onSelectPlan(plan.id)}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                Mais Popular
              </span>
            </div>
          )}

          <div className={`card-modern h-full ${
            selectedPlan === plan.id
              ? `border-${plan.color}-500 bg-${plan.color}-50/50 dark:bg-${plan.color}-900/20`
              : ''
          }`}>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                {plan.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {plan.description}
              </p>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {plan.price}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <Users size={16} className="mx-auto mb-1 text-gray-600" />
                <div className="text-xs text-gray-600 dark:text-gray-400">Usuários</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {plan.limits.users}
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <Bot size={16} className="mx-auto mb-1 text-gray-600" />
                <div className="text-xs text-gray-600 dark:text-gray-400">Agentes</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {plan.limits.agents}
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <Database size={16} className="mx-auto mb-1 text-gray-600" />
                <div className="text-xs text-gray-600 dark:text-gray-400">Coleções</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {plan.limits.collections}
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <BarChart3 size={16} className="mx-auto mb-1 text-gray-600" />
                <div className="text-xs text-gray-600 dark:text-gray-400">Storage</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {plan.limits.storage}
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Check size={16} className={`text-${plan.color}-600 flex-shrink-0`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            {/* Selection Indicator */}
            {selectedPlan === plan.id && (
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Check size={16} />
                  <span className="text-sm font-medium">Plano selecionado</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}