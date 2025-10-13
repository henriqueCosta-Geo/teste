'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Database, Bot, Search, Home, LogOut, User, Users } from 'lucide-react'
import StatusBar from '@/components/layout/status-bar'
import { CompactThemeToggle } from '@/components/ui/theme-toggle'
import { signOut } from 'next-auth/react'
import { useEffect } from 'react'
import Image from "next/image";

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()??""
  const router = useRouter()
  const { data: session, status } = useSession()

  // Páginas que não precisam do layout completo (incluindo callback SSO)
  const authPages = ['/auth/signin', '/auth/signup', '/auth/saml-complete', '/404', '/unauthorized']
  const isAuthPage = authPages.includes(pathname)

  // Redirecionar para login se não estiver autenticado
  useEffect(() => {
    if (status === 'loading') return // Ainda carregando

    if (!session && !isAuthPage) {
      router.push('/auth/signin')
      return
    }
  }, [session, status, isAuthPage, router])

  // Se é página de auth, renderizar apenas o conteúdo
  if (isAuthPage) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {children}
      </div>
    )
  }

  // Se ainda está carregando, mostrar loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="loading"></div>
        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>
          Carregando...
        </span>
      </div>
    )
  }

  // Se não está autenticado, não renderizar nada (o useEffect irá redirecionar)
  if (!session) {
    return null
  }

  // Layout completo para páginas autenticadas - FLEX COM HEADER/FOOTER FIXOS
  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>

      {/* Header FIXO NO TOPO */}
      <header className="shadow-sm border-b flex-shrink-0" style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo GeoCarbonite */}
            <div className="flex items-center flex-shrink-0">

            </div>

            {/* Navigation */}
            <nav className="flex space-x-4 lg:space-x-8 overflow-x-auto">
              <Link
                href="/"
                className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                  pathname === '/'
                    ? 'border-b-2'
                    : 'hover:opacity-75'
                }`}
                style={{
                  color: pathname === '/' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottomColor: pathname === '/' ? 'var(--accent-primary)' : 'transparent'
                }}
              >
                <Home size={16} />
                Home
              </Link>

              {/* SUPER_USER vê todas as funcionalidades */}
              {session.user?.role === 'SUPER_USER' && (
                <>
                  <Link
                    href="/collections"
                    className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                      pathname.startsWith('/collections')
                        ? 'border-b-2'
                        : 'hover:opacity-75'
                    }`}
                    style={{
                      color: pathname.startsWith('/collections') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottomColor: pathname.startsWith('/collections') ? 'var(--accent-primary)' : 'transparent'
                    }}
                  >
                    <Database size={16} />
                    Coleções
                  </Link>
                  <Link
                    href="/agents"
                    className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                      pathname.startsWith('/agents')
                        ? 'border-b-2'
                        : 'hover:opacity-75'
                    }`}
                    style={{
                      color: pathname.startsWith('/agents') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottomColor: pathname.startsWith('/agents') ? 'var(--accent-primary)' : 'transparent'
                    }}
                  >
                    <Bot size={16} />
                    Agentes
                  </Link>
                  <Link
                    href="/teams"
                    className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                      pathname.startsWith('/teams')
                        ? 'border-b-2'
                        : 'hover:opacity-75'
                    }`}
                    style={{
                      color: pathname.startsWith('/teams') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottomColor: pathname.startsWith('/teams') ? 'var(--accent-primary)' : 'transparent'
                    }}
                  >
                    <Users size={16} />
                    Times
                  </Link>
                  <Link
                    href="/admin/customers"
                    className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                      pathname.startsWith('/admin/customers')
                        ? 'border-b-2'
                        : 'hover:opacity-75'
                    }`}
                    style={{
                      color: pathname.startsWith('/admin/customers') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottomColor: pathname.startsWith('/admin/customers') ? 'var(--accent-primary)' : 'transparent'
                    }}
                  >
                    <Users size={16} />
                    Customers
                  </Link>
                  <Link
                    href="/database"
                    className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                      pathname.startsWith('/database')
                        ? 'border-b-2'
                        : 'hover:opacity-75'
                    }`}
                    style={{
                      color: pathname.startsWith('/database') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottomColor: pathname.startsWith('/database') ? 'var(--accent-primary)' : 'transparent'
                    }}
                  >
                    <Database size={16} />
                    Database
                  </Link>
                </>
              )}

              {/* ADMIN e REGULAR só veem busca */}
              <Link
                href="/search"
                className={`px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium flex items-center gap-1 lg:gap-2 transition-colors whitespace-nowrap ${
                  pathname.startsWith('/search')
                    ? 'border-b-2'
                    : 'hover:opacity-75'
                }`}
                style={{
                  color: pathname.startsWith('/search') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottomColor: pathname.startsWith('/search') ? 'var(--accent-primary)' : 'transparent'
                }}
              >
                <Search size={16} />
                Busca
              </Link>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
              <CompactThemeToggle />
              <div className="hidden lg:flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <User size={16} />
                <span>{session.user?.name || session.user?.email}</span>
              </div>
              <button
                onClick={() => {
                  const baseUrl = window.location.origin
                  signOut({ callbackUrl: `${baseUrl}/auth/signin` })
                }}
                className="flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-2 text-xs lg:text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                style={{ color: 'var(--text-secondary)' }}
              >
                <LogOut size={16} />
                <span className="hidden lg:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - SCROLL INDEPENDENTE ENTRE HEADER E FOOTER */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Footer FIXO NO RODAPÉ */}
      <footer className="border-t flex-shrink-0" style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="max-w-full mx-auto py-3 lg:py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-2">
            <p className="text-xs lg:text-sm text-center lg:text-left" style={{ color: 'var(--text-tertiary)' }}>
              GeoCarbonite v1.0.0 - Sistema Inteligente de Suporte Técnico
            </p>
            <div className="flex items-center gap-4 text-xs lg:text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <span>© 2024 GeoCarbonite</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
