import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const teamId = resolvedParams.id
  
  console.log('🎯 TEAMS EXECUTE PROXY - ID:', teamId)
  
  try {
    const url = `${API_BASE_URL}/api/agents/teams/${teamId}/execute`
    console.log('🔗 Chamando backend execute:', url)
    
    // Repassar o FormData diretamente
    const formData = await request.formData()
    console.log('📝 FormData recebido:', Object.fromEntries(formData.entries()))
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })
    
    console.log('📡 Backend execute response:', {
      status: response.status,
      statusText: response.statusText
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro do backend execute:', errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ Execute response do backend:', data)
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('❌ Erro no proxy execute:', error)
    return NextResponse.json(
      { error: 'Proxy execute error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}