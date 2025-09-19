'use client'

import { useEffect } from 'react'
import { useUserMetadata } from '@/hooks/useUserMetadata'

export default function CustomerThemeProvider({ children }: { children: React.ReactNode }) {
  const { metadata, loading } = useUserMetadata()

  useEffect(() => {
    if (!loading && metadata) {
      const { primary_color, theme } = metadata.ui || {}
      const customerName = metadata.customer?.name || ''

      // Adicionar classe do customer no body para diferenciação
      if (customerName) {
        const customerClass = `customer-${customerName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        document.body.classList.add(customerClass)

        // Limpar outras classes de customer
        const existingClasses = Array.from(document.body.classList).filter(c => c.startsWith('customer-'))
        existingClasses.forEach(c => {
          if (c !== customerClass) {
            document.body.classList.remove(c)
          }
        })
      }

      // Aplicar cor primária
      if (primary_color) {
        document.documentElement.style.setProperty('--accent-primary', primary_color)
        document.documentElement.style.setProperty('--primary-color', primary_color)

        // Adicionar variações da cor primária
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : null
        }

        const rgb = hexToRgb(primary_color)
        if (rgb) {
          // Criar variações da cor
          document.documentElement.style.setProperty(
            '--primary-color-rgb',
            `${rgb.r}, ${rgb.g}, ${rgb.b}`
          )
          document.documentElement.style.setProperty(
            '--primary-color-light',
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
          )
          document.documentElement.style.setProperty(
            '--primary-color-hover',
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`
          )
        }
      }

      // Aplicar tema dark/light
      if (theme) {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }
  }, [metadata, loading])

  return <>{children}</>
}