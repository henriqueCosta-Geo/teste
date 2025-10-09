import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

// GET /api/admin/customers/[id]/users - Listar usuários do customer
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

    // Listar usuários do customer
    const users = await prisma.users.findMany({
      where: {
        customer_id: customerId,
        deleted_at: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        is_active: true,
        last_login: true,
        created_at: true,
        updated_at: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        slug: customer.slug
      },
      users: users.map(user => ({
        ...user,
        created_at: user.created_at?.toISOString() || null,
        updated_at: user.updated_at?.toISOString() || null,
        last_login: user.last_login?.toISOString() || null
      }))
    })

  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST /api/admin/customers/[id]/users - Criar usuário no customer
export async function POST(
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
    const { name, email, username, password, role } = body

    // Validações básicas
    if (!name || !email || !username || !password) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, email, username, password' },
        { status: 400 }
      )
    }

    // Verificar se customer existe
    const customer = await prisma.customers.findUnique({
      where: {
        id: customerId,
        deleted_at: null
      },
      include: {
        _count: {
          select: {
            users: { where: { deleted_at: null } }
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Verificar limites do customer (carregar do arquivo TOML ou usar padrões)
    const maxUsers = await getCustomerUserLimit(customer.slug)

    if (maxUsers !== -1 && customer._count.users >= maxUsers) {
      return NextResponse.json(
        { error: `Limite de usuários atingido (${maxUsers})` },
        { status: 409 }
      )
    }

    // Verificar se email já existe
    const existingEmail = await prisma.users.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email já está em uso' },
        { status: 409 }
      )
    }

    // Verificar se username já existe GLOBALMENTE (unique constraint)
    const existingUsername = await prisma.users.findUnique({
      where: { username }
    })

    if (existingUsername && existingUsername.deleted_at === null) {
      return NextResponse.json(
        { error: 'Username já está em uso' },
        { status: 409 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12)

    // Criar usuário
    const newUser = await prisma.users.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        role: role || 'USER',
        customer_id: customerId,
        is_active: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        is_active: true,
        created_at: true
      }
    })

    return NextResponse.json({
      id: newUser.id,
      message: 'Usuário criado com sucesso',
      user: {
        ...newUser,
        created_at: newUser.created_at?.toISOString() || null
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Erro ao criar usuário:', error)

    // Tratamento específico para erros de constraint unique do Prisma
    if (error.code === 'P2002') {
      const fields = error.meta?.target || []
      if (fields.includes('username')) {
        return NextResponse.json(
          { error: 'Username já está em uso' },
          { status: 409 }
        )
      }
      if (fields.includes('email')) {
        return NextResponse.json(
          { error: 'Email já está em uso' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Dados duplicados: esse registro já existe' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Função auxiliar para obter limite de usuários do customer
async function getCustomerUserLimit(customerSlug: string): Promise<number> {
  try {
    const customer = await prisma.customers.findUnique({
      where: { slug: customerSlug }
    })

    if (!customer || !customer.metadata_file) {
      return 50 // padrão se não tiver metadados
    }

    // Carregar metadados do arquivo TOML
    try {
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')

      const metadataPath = join(process.cwd(), customer.metadata_file)
      const tomlContent = await readFile(metadataPath, 'utf-8')

      // Parser básico para extrair max_users
      const maxUsersMatch = tomlContent.match(/max_users\s*=\s*(-?\d+)/)
      if (maxUsersMatch) {
        return parseInt(maxUsersMatch[1])
      }
    } catch (fileError) {
      console.warn('Erro ao ler arquivo de metadados:', fileError)
    }

    return 50 // fallback padrão
  } catch (error) {
    console.error('Erro ao obter limite de usuários:', error)
    return 50 // fallback
  }
}