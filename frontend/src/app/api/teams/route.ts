import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/teams - Listar teams disponíveis
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 [TEAMS-API] Listando todos os teams ativos')

    // Retornar todos os teams ativos (não filtramos por customer pois teams são compartilhados)
    const teams = await prisma.agentTeams.findMany({
      where: {
        is_active: true
      },
      include: {
        leader: {
          select: {
            id: true,
            name: true
          }
        },
        members: {
          include: {
            agent: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    console.log(`   - Total de teams encontrados: ${teams.length}`)

    return NextResponse.json(teams)

  } catch (error) {
    console.error('Erro ao listar teams:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST /api/teams - Criar team (não usado - criação é feita via proxy para backend Python)
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Use /api/proxy/api/teams/ para criar times' },
    { status: 400 }
  )
}