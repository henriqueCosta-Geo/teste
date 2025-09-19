import { NextRequest, NextResponse } from 'next/server'
import { ServerMetadataOrchestrator } from '@/lib/metadata-orchestrator-server'

// Padrões de URL que indicam um customer específico
const CUSTOMER_URL_PATTERNS = [
  /^\/customer\/([^\/]+)/,      // /customer/demo/...
  /^\/([^\/]+)\/dashboard/,      // /demo/dashboard/...
  /^\/([^\/]+)\/agents/,         // /demo/agents/...
  /^\/([^\/]+)\/collections/,    // /demo/collections/...
  /^\/([^\/]+)\/teams/,          // /demo/teams/...
  /^\/([^\/]+)\/analytics/,      // /demo/analytics/...
]

// URLs que são sempre globais (não específicas de customer)
const GLOBAL_PATHS = [
  '/api/',
  '/admin/',
  '/auth/',
  '/_next/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml'
]

interface CustomerContext {
  slug: string
  isValid: boolean
  metadata?: any
  redirectUrl?: string
}

export async function detectCustomerFromUrl(request: NextRequest): Promise<CustomerContext | null> {
  const pathname = request.nextUrl.pathname

  // Verificar se é um path global
  if (GLOBAL_PATHS.some(path => pathname.startsWith(path))) {
    return null
  }

  // Tentar extrair slug do customer da URL
  let customerSlug: string | null = null

  for (const pattern of CUSTOMER_URL_PATTERNS) {
    const match = pathname.match(pattern)
    if (match && match[1]) {
      customerSlug = match[1]
      break
    }
  }

  if (!customerSlug) {
    return null
  }

  // Validar se o customer existe e está ativo
  try {
    const metadata = await ServerMetadataOrchestrator.getCustomerMetadata(customerSlug)

    return {
      slug: customerSlug,
      isValid: true,
      metadata
    }
  } catch (error) {
    console.error(`Customer '${customerSlug}' não encontrado:`, error)

    return {
      slug: customerSlug,
      isValid: false,
      redirectUrl: '/404'
    }
  }
}

export async function applyCustomerMetadata(
  request: NextRequest,
  response: NextResponse,
  customerContext: CustomerContext
): Promise<NextResponse> {
  const { metadata, slug } = customerContext

  if (!metadata) {
    return response
  }

  // Adicionar headers com informações do customer
  response.headers.set('X-Customer-Slug', slug)
  response.headers.set('X-Customer-Metadata', JSON.stringify({
    plan: 'CUSTOM',
    features: metadata.features || {},
    limits: metadata.limits || {}
  }))

  // Aplicar configurações de UI via CSS custom properties
  if (metadata.ui) {
    let cssOverrides = ''

    if (metadata.ui.primary_color) {
      cssOverrides += `--accent-primary: ${metadata.ui.primary_color};`
      cssOverrides += `--accent-hover: ${adjustColorBrightness(metadata.ui.primary_color, -20)};`
    }

    if (metadata.ui.theme) {
      response.headers.set('X-Theme-Default', metadata.ui.theme)
    }

    if (cssOverrides) {
      response.headers.set('X-CSS-Overrides', cssOverrides)
    }
  }

  // Aplicar configurações de segurança baseadas nas configurações
  // All customers now get enterprise-level security
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export async function validateCustomerAccess(
  request: NextRequest,
  customerContext: CustomerContext,
  userId?: number
): Promise<{ allowed: boolean; reason?: string; redirectUrl?: string }> {
  const { slug, metadata } = customerContext

  if (!metadata) {
    return {
      allowed: false,
      reason: 'Customer metadata not found',
      redirectUrl: '/404'
    }
  }

  // Verificar se customer está ativo
  if (!metadata.is_active) {
    return {
      allowed: false,
      reason: 'Customer is inactive',
      redirectUrl: '/maintenance'
    }
  }

  // Get limits from metadata or use defaults
  const maxUsers = metadata.limits?.max_users || 50
  const limits = { concurrent_users: maxUsers }

  // Verificar acesso a features específicas baseado na URL
  const pathname = request.nextUrl.pathname

  if (pathname.includes('/analytics') && !metadata.features?.analytics) {
    return {
      allowed: false,
      reason: 'Analytics feature not enabled',
      redirectUrl: `/customer/${slug}/dashboard`
    }
  }

  if (pathname.includes('/teams') && !metadata.features?.teams) {
    return {
      allowed: false,
      reason: 'Teams feature not enabled',
      redirectUrl: `/customer/${slug}/dashboard`
    }
  }

  if (pathname.includes('/agents') && !metadata.features?.agents) {
    return {
      allowed: false,
      reason: 'Agents feature not enabled',
      redirectUrl: `/customer/${slug}/dashboard`
    }
  }

  if (pathname.includes('/collections') && !metadata.features?.collections) {
    return {
      allowed: false,
      reason: 'Collections feature not enabled',
      redirectUrl: `/customer/${slug}/dashboard`
    }
  }

  // Validar permissões do usuário (se disponível)
  if (userId) {
    try {
      const userPermissions = await ServerMetadataOrchestrator.getUserPermissions(userId)

      // Verificar se usuário pertence ao customer
      if (userPermissions.user.customer_slug !== slug) {
        return {
          allowed: false,
          reason: 'User does not belong to this customer',
          redirectUrl: '/auth/signin'
        }
      }

      // Verificar permissões específicas baseadas na URL
      if (pathname.includes('/admin') && !userPermissions.permissions.can_manage_settings) {
        return {
          allowed: false,
          reason: 'Insufficient permissions for admin access',
          redirectUrl: `/customer/${slug}/dashboard`
        }
      }

    } catch (error) {
      console.error('Error validating user permissions:', error)
      return {
        allowed: false,
        reason: 'Error validating permissions',
        redirectUrl: '/auth/signin'
      }
    }
  }

  return { allowed: true }
}

// Função auxiliar para ajustar brilho de cor
function adjustColorBrightness(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const B = (num >> 8 & 0x00FF) + amt
  const G = (num & 0x0000FF) + amt

  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 +
    (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1)
}

// Função para extrair user ID do request (implementar conforme sistema de auth)
export function extractUserIdFromRequest(request: NextRequest): number | null {
  // Implementar baseado no seu sistema de autenticação
  // Exemplos:

  // 1. JWT token
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      // Decodificar JWT e extrair user ID
      // const token = authHeader.substring(7)
      // const decoded = jwt.verify(token, JWT_SECRET)
      // return decoded.userId
    } catch (error) {
      console.error('Error decoding JWT:', error)
    }
  }

  // 2. Session cookie
  const sessionCookie = request.cookies.get('session')
  if (sessionCookie) {
    try {
      // Decodificar session e extrair user ID
      // const session = JSON.parse(sessionCookie.value)
      // return session.userId
    } catch (error) {
      console.error('Error parsing session:', error)
    }
  }

  // 3. Next-auth session
  const nextAuthSession = request.cookies.get('next-auth.session-token')
  if (nextAuthSession) {
    // Implementar verificação de sessão do next-auth
  }

  return null
}