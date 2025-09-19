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

    // Buscar todos os teams disponíveis (relacionamento agora é via TOML)
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

    return NextResponse.json(teams)

  } catch (error) {
    console.error('Erro ao listar teams:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST /api/teams - Criar team
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description = "",
      leader_agent_id
    } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    // Criar o team (relacionamento com customer agora é via TOML)
    const team = await prisma.agentTeams.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        leader_agent_id: leader_agent_id ? parseInt(leader_agent_id) : null,
        is_active: true,
        customer_id: session.user.customer_id
      }
    })

    return NextResponse.json({
      id: team.id,
      message: 'Team criado com sucesso'
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar team:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}