import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permitir todas as rotas API para teste
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
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