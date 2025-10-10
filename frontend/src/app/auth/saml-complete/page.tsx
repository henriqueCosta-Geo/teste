'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function SamlCompletePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState('Processando autenticação SSO...')
  const [error, setError] = useState('')

  useEffect(() => {
    async function completeAuth() {
      try {
        const data = searchParams?.get('data')
        const returnTo = searchParams?.get('returnTo') || '/'

        if (!data) {
          throw new Error('Dados de autenticação ausentes')
        }

        // Decodifica dados do usuário
        const authData = JSON.parse(Buffer.from(data, 'base64').toString())
        const { userId, email, timestamp } = authData

        // Verifica se não expirou (5 minutos)
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          throw new Error('Token de autenticação expirado')
        }

        console.log('🔐 [SAML Complete] Logging in via NextAuth...', { userId, email })
        setStatus('Autenticando via NextAuth...')

        // Faz login usando o provider SAML SSO
        const result = await signIn('saml-sso', {
          userId: userId.toString(),
          email: email,
          redirect: false,
        })

        console.log('✅ [SAML Complete] SignIn result:', result)

        if (result?.error) {
          throw new Error(result.error)
        }

        if (result?.ok) {
          setStatus('Login bem-sucedido! Redirecionando...')
          // Pequeno delay para mostrar mensagem
          setTimeout(() => {
            router.push(returnTo)
            router.refresh()
          }, 500)
        } else {
          throw new Error('Resposta inesperada do NextAuth')
        }
      } catch (err) {
        console.error('❌ [SAML Complete] Error:', err)
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setStatus('Erro ao completar autenticação')

        // Redireciona para login após 3 segundos
        setTimeout(() => {
          router.push('/auth/signin?error=saml_error')
        }, 3000)
      }
    }

    completeAuth()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Spinner */}
          {!error && (
            <div className="mb-6">
              <div className="inline-block w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Status Icon */}
          {error && (
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {error ? 'Erro na Autenticação' : 'Autenticação SSO'}
          </h2>

          {/* Status */}
          <p className={`text-sm mb-4 ${error ? 'text-red-600' : 'text-gray-600'}`}>
            {error || status}
          </p>

          {/* Details */}
          {!error && (
            <div className="text-xs text-gray-400 mt-4">
              Aguarde enquanto completamos seu login corporativo
            </div>
          )}

          {error && (
            <div className="text-xs text-gray-500 mt-4">
              Você será redirecionado para a página de login em instantes...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
