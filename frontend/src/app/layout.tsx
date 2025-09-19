import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { CustomerMetadataProvider } from '@/hooks/useCustomerMetadata'
import CustomerThemeProvider from '@/components/providers/customer-theme-provider'
import ClientLayout from '@/components/layout/client-layout'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Qdrant Admin',
  description: 'Interface de administração para Qdrant Vector Database com Agentes IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Obter informações do customer do middleware
  const headersList = headers()
  const customerSlug = headersList.get('x-detected-customer') || headersList.get('x-customer-slug')
  const cssOverrides = headersList.get('x-css-overrides')
  const themeDefault = headersList.get('x-theme-default')

  return (
    <html lang="pt-BR" className={themeDefault === 'dark' ? 'dark' : ''}>
      <head>
        {cssOverrides && (
          <style dangerouslySetInnerHTML={{
            __html: `:root { ${cssOverrides} }`
          }} />
        )}
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <CustomerMetadataProvider customerSlug={customerSlug || undefined}>
              <CustomerThemeProvider>
                <ClientLayout>{children}</ClientLayout>
              </CustomerThemeProvider>
            </CustomerMetadataProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}