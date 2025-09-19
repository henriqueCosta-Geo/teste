import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ServerMetadataOrchestrator } from '@/lib/metadata-orchestrator-server'

// GET /api/user/metadata - Buscar metadados do usuário logado
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar permissões e metadados do usuário
    const userPermissions = await ServerMetadataOrchestrator.getUserPermissions(parseInt(session.user.id))

    return NextResponse.json(userPermissions)

  } catch (error) {
    console.error('Erro ao buscar metadados do usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}