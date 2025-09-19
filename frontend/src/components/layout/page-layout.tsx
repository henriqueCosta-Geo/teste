import React from 'react'
import { CompactThemeToggle } from '@/components/ui/theme-toggle'

interface PageLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  stats?: Array<{
    icon: React.ReactNode
    label: string
    value: string | number
  }>
  actions?: React.ReactNode
  className?: string
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  stats,
  actions,
  className = ''
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Universal Header */}
      <div className="card-dense">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 
                className="text-2xl font-bold truncate" 
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </h1>
              {stats && stats.length > 0 && (
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {stats.map((stat, index) => (
                    <span key={index} className="flex items-center gap-1">
                      {stat.icon}
                      <span>{stat.value} {stat.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <CompactThemeToggle />
            {actions}
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  )
}

// Loading state para o PageLayout
export const PageLayoutSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card-dense">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="flex gap-3">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1 animate-pulse" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Empty state universal
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="card text-center py-16 fade-in">
      <div className="relative">
        <div 
          className="absolute inset-0 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        />
        <div className="relative mx-auto mb-6 p-4 rounded-full" style={{ color: 'var(--text-tertiary)' }}>
          {icon}
        </div>
      </div>
      
      <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      
      {action && (
        <div className="scale-in">
          {action}
        </div>
      )}
    </div>
  )
}