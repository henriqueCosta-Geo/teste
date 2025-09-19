import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const urls = [
      'http://localhost:8000',
      'http://backend:8000',
      'http://qdrant_admin_backend:8000'
    ]
    
    const results = []
    
    for (const url of urls) {
      try {
        console.log(`🔍 Testing connection to: ${url}`)
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000) // 5s timeout
        })
        
        const data = await response.json()
        
        results.push({
          url,
          success: true,
          status: response.status,
          data
        })
        
        console.log(`✅ Success: ${url}`)
        
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        
        console.log(`❌ Failed: ${url} - ${error}`)
      }
    }
    
    return NextResponse.json({
      message: 'Backend connectivity test',
      results,
      environment: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        INTERNAL_API_URL: process.env.INTERNAL_API_URL,
        NODE_ENV: process.env.NODE_ENV
      }
    })
    
  } catch (error) {
    console.error('Backend test error:', error)
    return NextResponse.json(
      { 
        error: 'Backend test failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}