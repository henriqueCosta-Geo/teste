import { NextRequest, NextResponse } from "next/server"

// Configuração de runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    const { userId, action, resourceType, currentCount } = await request.json()

    // Verificar se o userId da sessão confere com o solicitado
    if (parseInt(session.user.id) !== userId) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      )
    }

    const validation = await MetadataOrchestrator.validateUserAction(
      userId,
      action,
      resourceType,
      currentCount
    )

    return NextResponse.json(validation)

  } catch (error) {
    console.error("Erro ao validar ação:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}