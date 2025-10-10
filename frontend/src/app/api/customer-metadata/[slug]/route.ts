import { NextRequest, NextResponse } from 'next/server'
import { ServerMetadataOrchestrator } from '@/lib/metadata-orchestrator-server'

// GET /api/customer-metadata/[slug] - Obter metadata parseado de um customer
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const customerSlug = params?.slug

    if (!customerSlug) {
      return NextResponse.json({ error: 'Slug é obrigatório' }, { status: 400 })
    }

    // Usar o mesmo orchestrator que o useUserMetadata usa
    const metadata = await ServerMetadataOrchestrator.getCustomerMetadata(customerSlug)

    return NextResponse.json(metadata)

  } catch (error) {
    console.error('Erro ao buscar metadata do customer:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar metadata' },
      { status: 500 }
    )
  }
}
