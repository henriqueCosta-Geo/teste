import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permitir explicitamente callbacks SAML do Azure AD (Pages Router API)
  // Rotas dinâmicas: /saml/acs/17, /saml/logout/17, /saml/metadata
  if (pathname.startsWith("/saml/")) {
    const response = NextResponse.next()
    // Confiar no host forwarded pelo Railway
    const forwardedHost = req.headers.get('x-forwarded-host')
    const forwardedProto = req.headers.get('x-forwarded-proto')
    if (forwardedHost) {
      response.headers.set('x-forwarded-host', forwardedHost)
    }
    if (forwardedProto) {
      response.headers.set('x-forwarded-proto', forwardedProto)
    }
    return response
  }

  // Permitir todas as outras rotas API (incluindo NextAuth e Server Actions)
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next()
    // Garantir que headers do Railway sejam propagados
    const forwardedHost = req.headers.get('x-forwarded-host')
    const forwardedProto = req.headers.get('x-forwarded-proto')
    if (forwardedHost) {
      response.headers.set('x-forwarded-host', forwardedHost)
    }
    if (forwardedProto) {
      response.headers.set('x-forwarded-proto', forwardedProto)
    }
    return response
  }

  const response = NextResponse.next()

  try {
    // Obter token JWT para identificar o customer
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (token && token.customer_slug) {
      const customerSlug = token.customer_slug as string
      response.headers.set('x-detected-customer', customerSlug)
      response.headers.set('x-customer-slug', customerSlug)
    }
  } catch (error) {
    console.warn('Erro no middleware de customer:', error)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}