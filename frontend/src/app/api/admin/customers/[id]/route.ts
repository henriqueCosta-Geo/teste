import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { join } from 'path'

import { prisma } from '@/lib/prisma'

// GET /api/admin/customers/[id] - Obter customer específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const customer = await prisma.customers.findUnique({
      where: {
        id: customerId,
        deleted_at: null
      },
      include: {
        users: {
          where: { deleted_at: null },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            is_active: true,
            last_login: true,
            created_at: true
          }
        },
        _count: {
          select: {
            users: { where: { deleted_at: null } },
            chat_sessions: true
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Calcular métricas adicionais
    const last30Days = new Date()
    last30Days.setDate(last30Days.getDate() - 30)

    const recentActivity = await prisma.chatSessions.count({
      where: {
        customer_id: customerId,
        created_at: {
          gte: last30Days
        }
      }
    })

    const response = {
      id: customer.id,
      name: customer.name,
      slug: customer.slug,
      is_active: customer.is_active,
      metadata_file: customer.metadata_file,
      created_at: customer.created_at.toISOString(),
      updated_at: customer.updated_at.toISOString(),
      users: customer.users,
      metrics: {
        total_users: customer._count.users,
        total_sessions: customer._count.chat_sessions,
        recent_activity: recentActivity
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Erro ao obter customer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/customers/[id] - Atualizar customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { name, is_active } = body

    // Verificar se customer existe
    const existingCustomer = await prisma.customers.findUnique({
      where: {
        id: customerId,
        deleted_at: null
      }
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Atualizar customer
    const updatedCustomer = await prisma.customers.update({
      where: { id: customerId },
      data: {
        name: name || existingCustomer.name,
        is_active: is_active !== undefined ? is_active : existingCustomer.is_active,
        updated_at: new Date()
      }
    })

    return NextResponse.json({
      message: 'Customer atualizado com sucesso',
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        slug: updatedCustomer.slug,
        is_active: updatedCustomer.is_active
      }
    })

  } catch (error) {
    console.error('Erro ao atualizar customer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/customers/[id] - Deletar customer (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Verificar se customer existe
    const customer = await prisma.customers.findUnique({
      where: {
        id: customerId,
        deleted_at: null
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Soft delete do customer e usuários relacionados
    await prisma.$transaction([
      // Desativar customer
      prisma.customers.update({
        where: { id: customerId },
        data: {
          is_active: false,
          deleted_at: new Date()
        }
      }),
      // Desativar usuários
      prisma.users.updateMany({
        where: { customer_id: customerId },
        data: {
          is_active: false,
          deleted_at: new Date()
        }
      }),
    ])

    // Opcionalmente, remover arquivo TOML
    try {
      if (customer.metadata_file) {
        const tomlPath = join(process.cwd(), customer.metadata_file)
        await unlink(tomlPath)
      }
    } catch (fileError) {
      console.warn('Não foi possível remover arquivo TOML:', fileError)
    }

    return NextResponse.json({
      message: 'Customer deletado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao deletar customer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}