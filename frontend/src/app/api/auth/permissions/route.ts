import { NextRequest, NextResponse } from "next/server"

// Configuração de runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Import dinâmico para evitar problemas no build
    const { getServerSession } = await import("next-auth")
    const { authOptions } = await import("@/lib/auth")
    const { MetadataOrchestrator } = await import("@/lib/metadata-orchestrator")
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id)
    const permissions = await MetadataOrchestrator.getUserPermissions(userId)

    return NextResponse.json(permissions)

  } catch (error) {
    console.error("Erro ao buscar permissões:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}