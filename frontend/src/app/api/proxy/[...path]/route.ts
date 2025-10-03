import { NextRequest, NextResponse } from 'next/server'

// URL do backend - prioriza INTERNAL para container-to-container, fallback para dev
const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

console.log(`API_BASE_URL: ${API_BASE_URL}`)

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
      const requestContentType = request.headers.get('content-type')
      console.log(`Content-Type received: ${requestContentType}`)

      if (requestContentType) {
        headers['Content-Type'] = requestContentType
      }

      let body: BodyInit | undefined = undefined

      if (method !== 'GET' && method !== 'DELETE') {
        try {
          if (requestContentType?.includes('application/json')) {
            body = JSON.stringify(await request.json())
            console.log('Processing as JSON')
          } else if (requestContentType?.includes('multipart/form-data') || requestContentType?.includes('application/x-www-form-urlencoded')) {
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
        signal: AbortSignal.timeout(120000), // 120 segundos (2 minutos) timeout para streaming
      })

      console.log(`Success: ${response.status} ${response.statusText}`)

      // Verificar se é streaming
      const responseContentType = response.headers.get('content-type')
      if (responseContentType?.includes('text/event-stream')) {
        console.log('🔄 Detectado streaming response, repassando stream')
        // Retornar stream diretamente
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      }

      const responseData = await response.text()

      return new NextResponse(responseData, {
        status: response.status,
        headers: {
          'Content-Type': responseContentType || 'application/json',
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