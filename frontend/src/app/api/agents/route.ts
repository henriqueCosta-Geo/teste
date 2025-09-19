import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/agents - Listar agentes do customer do usuário
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Buscar todos os agentes disponíveis (relacionamento agora é via TOML)
    const agents = await prisma.agents.findMany({
      where: {
        is_active: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        role: true,
        model: true,
        temperature: true,
        instructions: true,
        tools_config: true,
        is_active: true,
        created_at: true,
        updated_at: true
      }
    })

    return NextResponse.json(agents)

  } catch (error) {
    console.error('Erro ao listar agentes:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST /api/agents - Criar agente
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
      role = "",
      model = 'gpt-4o-mini',
      temperature = 0.7,
      instructions = "",
      tools_config = ['rag']
    } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }


    // Criar o agente (relacionamento com customer agora é via TOML)
    const agent = await prisma.agents.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        role: role.trim(),
        model,
        temperature,
        instructions: instructions.trim(),
        tools_config,
        is_active: true
      }
    })

    return NextResponse.json({
      id: agent.id,
      message: 'Agente criado com sucesso'
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar agente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}