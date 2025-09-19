import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 TEST TEAMS ENDPOINT FUNCIONANDO!')
  console.log('🧪 URL:', request.url)
  
  return NextResponse.json({
    message: 'Test teams endpoint working!',
    url: request.url,
    timestamp: new Date().toISOString()
  })
}