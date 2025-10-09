import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Seguir o padrão do projeto para comunicação server-side
const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string; messageId: string } }
) {
  try {
    console.log('🔍 [FEEDBACK-PROXY] API_BASE_URL:', API_BASE_URL)

    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { chatId, messageId } = params
    const body = await request.json()

    console.log('📝 [FEEDBACK-PROXY] Recebido:', { chatId, messageId, body })

    // Validar dados
    if (!body.rating || ![1, 5].includes(body.rating)) {
      return NextResponse.json(
        { error: 'Rating inválido. Use 1 (negativo) ou 5 (positivo)' },
        { status: 400 }
      )
    }

    // Preparar payload para o backend
    const feedbackData = {
      rating: body.rating,
      comment: body.comment || null,
      created_at: body.created_at || new Date().toISOString(),
      user_id: parseInt(session.user.id)
    }

    const backendUrl = `${API_BASE_URL}/api/chats/${chatId}/messages/${messageId}/feedback`
    console.log('🚀 [FEEDBACK-PROXY] Enviando para backend:', backendUrl)

    // Enviar para o backend Python
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedbackData)
    })

    console.log('📥 [FEEDBACK-PROXY] Status do backend:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Erro desconhecido' }))
      console.error('❌ [FEEDBACK-PROXY] Erro do backend:', errorData)
      return NextResponse.json(
        { error: errorData.detail || 'Erro ao salvar feedback' },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('✅ [FEEDBACK-PROXY] Sucesso:', result)

    return NextResponse.json(
      {
        success: true,
        message: 'Feedback salvo com sucesso',
        data: result
      },
      { status: 200 }
    )

  } catch (error: any) {
    console.error('❌ [FEEDBACK-PROXY] Erro ao processar feedback:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar feedback', details: error.message },
      { status: 500 }
    )
  }
}
