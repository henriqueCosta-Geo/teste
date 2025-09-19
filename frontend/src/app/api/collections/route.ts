import { NextRequest, NextResponse } from 'next/server'

// Detecta se está rodando em Docker local ou Railway
const isLocalDocker = process.env.NODE_ENV === 'production' && process.env.HOSTNAME && !process.env.RAILWAY_ENVIRONMENT
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (isLocalDocker ? 'http://backend:8000' : 'http://localhost:8000')

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/collections`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Collections API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const response = await fetch(`${API_BASE_URL}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Collections create error:', error)
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    )
  }
}