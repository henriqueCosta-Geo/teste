import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const teamId = resolvedParams.id
  
  console.log('🎯🎯🎯 TEAMS PROXY FUNCIONANDO! - ID:', teamId)
  console.log('🎯🎯🎯 URL completa:', request.url)
  console.log('🎯🎯🎯 Params recebidos:', resolvedParams)
  
  try {
    const url = `${API_BASE_URL}/api/agents/teams/${teamId}`
    console.log('🔗 Chamando backend:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    console.log('📡 Backend response:', {
      status: response.status,
      statusText: response.statusText
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro do backend:', errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ Dados recebidos do backend:', data)
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('❌ Erro no proxy:', error)
    return NextResponse.json(
      { error: 'Proxy error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}