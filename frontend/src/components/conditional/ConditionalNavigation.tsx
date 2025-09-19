import React from 'react'
import Link from 'next/link'
import { useFeatureEnabled, useCustomerMetadata } from '@/hooks/useCustomerMetadata'
import { Bot, Database, Users, BarChart3, Settings, Building2 } from 'lucide-react'

interface NavigationItem {
  href: string
  label: string
  icon: React.ReactNode
  feature?: keyof NonNullable<import('@/lib/types').CustomerMetadata['features']>
  adminOnly?: boolean
  description?: string
}

const navigationItems: NavigationItem[] = [
  {
    href: '/collections',
    label: 'Coleções',
    icon: <Database size={20} />,
    feature: 'collections',
    description: 'Gerencie documentos e bases de conhecimento'
  },
  {
    href: '/agents',
    label: 'Agentes',
    icon: <Bot size={20} />,
    feature: 'agents',
    description: 'Configure assistentes IA inteligentes'
  },
  {
    href: '/teams',
    label: 'Teams',
    icon: <Users size={20} />,
    feature: 'teams',
    description: 'Coordene times de agentes'
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: <BarChart3 size={20} />,
    feature: 'analytics',
    description: 'Métricas e insights de desempenho'
  },
  {
    href: '/admin/customers',
    label: 'Customers',
    icon: <Building2 size={20} />,
    adminOnly: true,
    description: 'Administração de clientes'
  },
  {
    href: '/settings',
    label: 'Configurações',
    icon: <Settings size={20} />,
    description: 'Configurações do sistema'
  }
]

interface ConditionalNavigationProps {
  className?: string
  orientation?: 'horizontal' | 'vertical'
  showDescriptions?: boolean
}

export const ConditionalNavigation: React.FC<ConditionalNavigationProps> = ({
  className = '',
  orientation = 'horizontal',
  showDescriptions = false
}) => {
  const { userPermissions } = useCustomerMetadata()

  const getVisibleItems = () => {
    return navigationItems.filter(item => {
      // Verificar se é feature que precisa de verificação
      if (item.feature) {
        const isEnabled = useFeatureEnabled(item.feature)
        if (!isEnabled) return false
      }

      // Verificar se é item admin-only
      if (item.adminOnly) {
        const isAdmin = userPermissions?.user?.role === 'ADMIN' ||
                       userPermissions?.user?.role === 'SUPER_USER'
        if (!isAdmin) return false
      }

      return true
    })
  }

  const visibleItems = getVisibleItems()

  const containerClass = orientation === 'vertical'
    ? 'flex flex-col space-y-2'
    : 'flex flex-row space-x-4'

  return (
    <nav className={`${containerClass} ${className}`}>
      {visibleItems.map((item) => (
        <NavigationLink
          key={item.href}
          item={item}
          orientation={orientation}
          showDescription={showDescriptions}
        />
      ))}
    </nav>
  )
}

interface NavigationLinkProps {
  item: NavigationItem
  orientation: 'horizontal' | 'vertical'
  showDescription: boolean
}

const NavigationLink: React.FC<NavigationLinkProps> = ({
  item,
  orientation,
  showDescription
}) => {
  const baseClasses = `
    flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200
    text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white
    hover:bg-gray-100 dark:hover:bg-gray-800
    border border-transparent hover:border-gray-200 dark:hover:border-gray-700
  `

  const verticalClasses = orientation === 'vertical' ? 'w-full justify-start' : ''

  return (
    <Link
      href={item.href}
      className={`${baseClasses} ${verticalClasses}`}
      title={item.description}
    >
      <span className="flex-shrink-0">
        {item.icon}
      </span>

      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">
          {item.label}
        </span>

        {showDescription && item.description && orientation === 'vertical' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  )
}

// Componente de navegação para sidebar
export const SidebarNavigation: React.FC<{ className?: string }> = ({ className = '' }) => (
  <ConditionalNavigation
    className={className}
    orientation="vertical"
    showDescriptions={true}
  />
)

// Componente de navegação para header
export const HeaderNavigation: React.FC<{ className?: string }> = ({ className = '' }) => (
  <ConditionalNavigation
    className={className}
    orientation="horizontal"
    showDescriptions={false}
  />
)

// Hook para obter estatísticas de navegação
export const useNavigationStats = () => {
  const totalItems = navigationItems.length
  const { userPermissions } = useCustomerMetadata()

  const enabledFeatures = navigationItems.filter(item => {
    if (item.feature) {
      return useFeatureEnabled(item.feature)
    }
    if (item.adminOnly) {
      return userPermissions?.user?.role === 'ADMIN' ||
             userPermissions?.user?.role === 'SUPER_USER'
    }
    return true
  }).length

  return {
    total: totalItems,
    enabled: enabledFeatures,
    disabled: totalItems - enabledFeatures,
    enabledPercentage: Math.round((enabledFeatures / totalItems) * 100)
  }
}