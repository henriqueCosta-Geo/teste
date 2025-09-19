import { NextRequest, NextResponse } from 'next/server'

// Detecta se está rodando em Docker local ou Railway
const isLocalDocker = process.env.NODE_ENV === 'production' && process.env.HOSTNAME && !process.env.RAILWAY_ENVIRONMENT
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (isLocalDocker ? 'http://backend:8000' : 'http://localhost:8000')

console.log(`Environment: ${process.env.NODE_ENV}, isLocalDocker: ${isLocalDocker}, API_BASE_URL: ${API_BASE_URL}`)

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  console.log('🔍 PROXY GET REQUEST:', {
    url: request.url,
    path: params.path,
    pathJoined: params.path?.join('/')
  })
  return proxyRequest(request, params.path, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE')
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const maxRetries = 3
  const retryDelay = 1000 // 1 segundo
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const path = pathSegments.join('/')
      const searchParams = request.nextUrl.searchParams.toString()
      const url = `${API_BASE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`

      console.log(`Attempt ${attempt}: ${method} ${url}`)

      const headers: HeadersInit = {}
      
      // Copy relevant headers
      const contentType = request.headers.get('content-type')
      console.log(`Content-Type received: ${contentType}`)
      
      if (contentType) {
        headers['Content-Type'] = contentType
      }

      let body: BodyInit | undefined = undefined
      
      if (method !== 'GET' && method !== 'DELETE') {
        try {
          if (contentType?.includes('application/json')) {
            body = JSON.stringify(await request.json())
            console.log('Processing as JSON')
          } else if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
            body = await request.formData()
            console.log('Processing as FormData')
            // Remove Content-Type header to let fetch set it with boundary
            delete headers['Content-Type']
          } else {
            // Try to detect FormData even without proper Content-Type
            try {
              const formData = await request.formData()
              body = formData
              console.log('Processing as FormData (auto-detected)')
              delete headers['Content-Type']
            } catch (e) {
              body = await request.text()
              console.log('Processing as text')
            }
          }
        } catch (error) {
          console.error('Error processing request body:', error)
          body = undefined
        }
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(10000), // 10 segundos timeout
      })

      const responseData = await response.text()
      console.log(`Success: ${response.status} ${response.statusText}`)
      
      return new NextResponse(responseData, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'application/json',
        },
      })

    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        address: error.cause?.address,
        port: error.cause?.port
      })

      if (attempt === maxRetries) {
        // Último retry falhou
        if (error.code === 'ECONNREFUSED') {
          return NextResponse.json(
            { 
              error: 'Backend service unavailable. Please check if the backend container is running.',
              details: `Cannot connect to ${API_BASE_URL}`,
              retries: maxRetries
            },
            { status: 503 }
          )
        }
        
        return NextResponse.json(
          { 
            error: 'Internal server error',
            details: error.message,
            retries: maxRetries
          },
          { status: 500 }
        )
      }

      // Aguarda antes do próximo retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
    }
  }
}