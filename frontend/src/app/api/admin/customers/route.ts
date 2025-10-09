import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import bcrypt from 'bcryptjs'

// GET /api/admin/customers - Listar customers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar se é ADMIN ou SUPER_USER
    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customers = await prisma.customers.findMany({
      where: {
        deleted_at: null
      },
      include: {
        _count: {
          select: {
            users: { where: { deleted_at: null } }
          }
        },
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    console.log(`📋 [CUSTOMERS-API] User role: ${session.user.role}, Customer ID: ${session.user.customer_id}`)
    console.log(`📋 [CUSTOMERS-API] Total customers found: ${customers.length}`)
    console.log(`📋 [CUSTOMERS-API] Customer IDs: ${customers.map(c => c.id).join(', ')}`)

    // Transformar dados para o formato esperado pelo frontend
    const customersResponse = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      slug: customer.slug,
      is_active: customer.is_active,
      metadata_file: customer.metadata_file,
      users_count: customer._count.users,
      created_at: customer.created_at?.toISOString() || null,
      updated_at: customer.updated_at?.toISOString() || null
    }))

    return NextResponse.json(customersResponse)

  } catch (error) {
    console.error('Erro ao listar customers:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST /api/admin/customers - Criar customer
export async function POST(request: NextRequest) {
  let slug: string | undefined

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      slug: bodySlug,
      description,
      metadata_toml,
      create_admin,
      admin_data
    } = body

    slug = bodySlug

    // Validações básicas
    if (!name || !slug || !metadata_toml) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, slug, metadata_toml' },
        { status: 400 }
      )
    }

    // Verificar se slug já existe
    const existingCustomer = await prisma.customers.findUnique({
      where: { slug }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Slug já existe' },
        { status: 409 }
      )
    }

    // Validar TOML
    try {
      // Validação básica de sintaxe TOML
      const tomlLines = metadata_toml.split('\n')
      const hasValidSections = tomlLines.some((line: string) => line.match(/^\[[\w\.]+\]$/))

      if (!hasValidSections) {
        return NextResponse.json(
          { error: 'TOML deve conter pelo menos uma seção válida' },
          { status: 400 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'TOML inválido' },
        { status: 400 }
      )
    }

    // Criar customer no banco com TOML armazenado diretamente
    const customer = await prisma.customers.create({
      data: {
        name,
        slug,
        metadata_toml: metadata_toml, // Salvar TOML diretamente no banco
        is_active: true
      }
    })

    // Criar usuário admin inicial se solicitado
    if (create_admin && admin_data) {
      // Verificar se email já existe
      const existingEmail = await prisma.users.findUnique({
        where: { email: admin_data.email }
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email já está em uso' },
          { status: 409 }
        )
      }

      // Verificar se username já existe e gerar um único se necessário
      let username = admin_data.username
      let usernameCounter = 1

      while (true) {
        const existingUsername = await prisma.users.findUnique({
          where: { username }
        })

        if (!existingUsername) {
          break
        }

        username = `${admin_data.username}${usernameCounter}`
        usernameCounter++
      }

      const hashedPassword = await bcrypt.hash(admin_data.password, 12)

      await prisma.users.create({
        data: {
          name: admin_data.name,
          email: admin_data.email,
          username: username, // Usar o username único gerado
          password: hashedPassword,
          role: 'ADMIN',
          customer_id: customer.id,
          is_active: true
        }
      })
    }

    return NextResponse.json({
      id: customer.id,
      message: 'Customer criado com sucesso'
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar customer:', error)

    // Se deu erro, tentar limpar o que foi criado
    try {
      if (slug) {
        await prisma.customers.deleteMany({
          where: { slug: slug }
        })
      }
    } catch (cleanupError) {
      console.error('Erro no cleanup:', cleanupError)
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}