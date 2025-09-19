import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/admin/customers/validate-slug?slug=example
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { error: 'Parâmetro slug é obrigatório' },
        { status: 400 }
      )
    }

    // Validar formato do slug
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        available: false,
        reason: 'Slug deve conter apenas letras minúsculas, números e hífens'
      })
    }

    // Verificar se slug já existe
    const existingCustomer = await prisma.customers.findUnique({
      where: { slug },
      select: { id: true, name: true, is_active: true }
    })

    if (existingCustomer) {
      return NextResponse.json({
        available: false,
        reason: 'Slug já está em uso',
        existing_customer: {
          id: existingCustomer.id,
          name: existingCustomer.name,
          is_active: existingCustomer.is_active
        }
      })
    }

    // Verificar slugs reservados
    const reservedSlugs = [
      'admin', 'api', 'www', 'mail', 'ftp', 'localhost', 'test', 'demo',
      'dashboard', 'app', 'portal', 'console', 'manage', 'system',
      'auth', 'login', 'register', 'signup', 'signin', 'logout',
      'static', 'assets', 'public', 'private', 'secure'
    ]

    if (reservedSlugs.includes(slug.toLowerCase())) {
      return NextResponse.json({
        available: false,
        reason: 'Slug é reservado pelo sistema'
      })
    }

    return NextResponse.json({
      available: true,
      slug: slug
    })

  } catch (error) {
    console.error('Erro ao validar slug:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}