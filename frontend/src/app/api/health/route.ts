import { NextResponse } from 'next/server'

// URL do backend - Railway ou local
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    console.log(`Health check - API_BASE_URL: ${API_BASE_URL}`)
    
    // Tenta conectar no backend
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`${API_BASE_URL}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({
        frontend: 'ok',
        backend: 'ok',
        connection: 'successful',
        backend_data: data,
        config: {
          environment: process.env.NODE_ENV,
          isDocker,
          apiBaseUrl: API_BASE_URL,
          hostname: process.env.HOSTNAME
        }
      })
    } else {
      return NextResponse.json({
        frontend: 'ok',
        backend: 'error',
        connection: 'failed',
        error: `HTTP ${response.status} ${response.statusText}`,
        config: {
          environment: process.env.NODE_ENV,
          isDocker,
          apiBaseUrl: API_BASE_URL,
          hostname: process.env.HOSTNAME
        }
      }, { status: 503 })
    }

  } catch (error: any) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      frontend: 'ok',
      backend: 'unreachable',
      connection: 'failed',
      error: error.message,
      errorCode: error.code,
      config: {
        environment: process.env.NODE_ENV,
        isDocker,
        apiBaseUrl: API_BASE_URL,
        hostname: process.env.HOSTNAME
      }
    }, { status: 503 })
  }
}