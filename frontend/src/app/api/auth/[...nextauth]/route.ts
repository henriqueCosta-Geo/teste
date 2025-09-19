import NextAuth from "next-auth"

// Configuração de runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Import dinâmico das opções de auth para evitar problemas no build
const getHandler = async () => {
  const { authOptions } = await import("@/lib/auth")
  return NextAuth(authOptions)
}

export async function GET(request: Request, context: any) {
  const handler = await getHandler()
  return handler(request, context)
}

export async function POST(request: Request, context: any) {
  const handler = await getHandler()
  return handler(request, context)
}