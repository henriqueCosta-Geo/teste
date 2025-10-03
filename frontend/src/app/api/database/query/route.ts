import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${API_BASE_URL}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to execute query' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error executing query:', error)
    return NextResponse.json(
      { error: 'Failed to execute query', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
