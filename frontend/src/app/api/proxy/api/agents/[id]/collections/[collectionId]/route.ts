import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; collectionId: string } }
) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/agents/${params.id}/collections/${params.collectionId}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao remover coleção: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Erro no proxy DELETE /api/agents/[id]/collections/[collectionId]:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}