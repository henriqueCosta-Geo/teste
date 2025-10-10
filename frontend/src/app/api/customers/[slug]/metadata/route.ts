import { NextRequest, NextResponse } from 'next/server'
import { ServerMetadataOrchestrator } from '@/lib/metadata-orchestrator-server'

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

    // Buscar metadados do customer
    const metadata = await ServerMetadataOrchestrator.getCustomerMetadata(customerSlug)

    return NextResponse.json({
      customer: {
        slug: customerSlug
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