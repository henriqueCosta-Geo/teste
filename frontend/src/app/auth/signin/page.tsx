'use client'

import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { Button } from "primereact/button";
import { useState, useCallback } from "react";

export default function SignInPage({ searchParams }: { searchParams: { customer?: string } }) {
  const customer = searchParams?.customer;
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const [corpLoading, setCorpLoading] = useState(false);
const handleCorporateLogin = useCallback(() => {
    try {
      setCorpLoading(true);

      // Monte o "returnTo" como quiser. Exemplo: volta para /app; se tiver cliente, volta para /app/<cliente>
      const returnTo =
        customer && customer.trim().length > 0 ? `/app/${encodeURIComponent(customer)}` : "/app";

      // Redirect completo (fora do SPA) para o IdP via nosso endpoint
      const url = `/api/saml/login?returnTo=${encodeURIComponent(returnTo)}`;
      window.location.href = url;
    } catch (e) {
      console.error("❌ Erro ao iniciar SSO:", e);
      setCorpLoading(false);
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        setError('Email ou senha incorretos')
      } else {
        // Verificar se login foi bem-sucedido
        const session = await getSession()
        if (session) {
          router.push('/')
          router.refresh()
        }
      }
    } catch (error) {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Background SVG (60%) */}
      <div
        className="hidden lg:flex lg:w-3/5 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/images/login_background.svg)',
          backgroundColor: '#f8fafc' // Fallback color
        }}
      >
        {/* Apenas o background SVG, sem conteúdo adicional */}
      </div>

      {/* Lado Direito - Formulário de Login (40%) */}
      <div className="w-full lg:w-2/5 flex items-center justify-center bg-white">
        <div className="max-w-md w-full space-y-8 p-8">
          {/* Logo GeoCarbonite - sempre visível no lado direito */}
          <div className="text-center">
            <img
              src="/images/geocarbonite_logo.png"
              alt="GeoCarbonite"
              className="h-32 w-auto mx-auto mb-6"
            />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              Sistema Inteligente de Suporte
            </h2>
            <p className="text-gray-500 mb-8">
              Faça login na sua conta
            </p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Entrar
              </>
            )}
          </button>
        </form>

        <Button
            type="button"
            onClick={handleCorporateLogin}
            disabled={corpLoading}
            className="w-full !bg-white !border-black !text-black hover:!bg-black hover:!text-white disabled:!opacity-60"
            label={
              corpLoading
                ? "Redirecionando..."
                : `Login corporativo${customer ? ` (${customer})` : ""}`
            }
            icon="pi pi-building-columns"
          />
        </div>
      </div>
    </div>
  )
}