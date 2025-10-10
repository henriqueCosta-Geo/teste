import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/agents/${params?.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao buscar agente: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Erro no proxy GET /api/agents/[id]:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData()

    const response = await fetch(`${API_BASE_URL}/api/agents/${params?.id}`, {
      method: 'PUT',
      body: formData,
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao atualizar agente: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Erro no proxy PUT /api/agents/[id]:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/agents/${params?.id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao deletar agente: ${response.status}` },
        { status: response.status }
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Erro no proxy DELETE /api/agents/[id]:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}