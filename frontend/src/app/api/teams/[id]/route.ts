import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const teamIdParam = resolvedParams?.id

  console.log('🔍 [TEAMS-API-GET] Buscando team por ID:', teamIdParam)

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validar se o ID é numérico
    const teamId = parseInt(teamIdParam)

    if (isNaN(teamId)) {
      console.error('❌ ID inválido (não numérico):', teamIdParam)
      return NextResponse.json(
        { error: 'ID inválido. Deve ser um número.' },
        { status: 400 }
      )
    }

    // Buscar team no PostgreSQL via Prisma
    const team = await prisma.agentTeams.findUnique({
      where: { id: teamId },
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        members: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      }
    })

    if (!team) {
      console.error('❌ Team não encontrado no banco:', teamId)
      return NextResponse.json(
        { error: 'Team não encontrado' },
        { status: 404 }
      )
    }

    console.log('✅ Team encontrado no Prisma:', team.name, `(${team.members.length} membros)`)

    return NextResponse.json(team)

  } catch (error) {
    console.error('❌ Erro ao buscar team:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}