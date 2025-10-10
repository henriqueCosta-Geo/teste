import { NextRequest, NextResponse } from 'next/server'
import { ServerMetadataOrchestrator } from '@/lib/metadata-orchestrator-server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/customers/{slug}/metadata - Buscar metadados de um customer específico
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const customerSlug = params?.slug

    if (!customerSlug) {
      return NextResponse.json({ error: 'Customer slug é obrigatório' }, { status: 400 })
    }

    // Buscar customer no banco para obter o nome
    const customer = await prisma.customers.findUnique({
      where: { slug: customerSlug, is_active: true, deleted_at: null },
      select: { id: true, name: true, slug: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Buscar metadados do customer
    const metadata = await ServerMetadataOrchestrator.getCustomerMetadata(customerSlug)

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        slug: customer.slug
      },
      ...metadata
    })

  } catch (error) {
    console.error(`Erro ao buscar metadados do customer ${params?.slug}:`, error)

    // Se o customer não foi encontrado, retornar 404
    if (error instanceof Error && error.message.includes('não encontrado')) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}