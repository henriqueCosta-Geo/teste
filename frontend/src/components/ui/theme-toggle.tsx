import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="btn-outline"
      title={`Tema atual: ${theme === 'light' ? 'Claro' : 'Escuro'}`}
      aria-label="Alternar tema"
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      {theme === 'light' ? 'Escuro' : 'Claro'}
    </button>
  )
}

// Versão compacta para headers
export const CompactThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
      }}
      title={`Alternar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
      aria-label="Alternar tema"
    >
      {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  )
}