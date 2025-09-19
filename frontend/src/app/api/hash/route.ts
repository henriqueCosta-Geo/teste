import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 })
    }
    
    // Gerar hash
    const hash = await bcrypt.hash(password, 12)
    
    // Verificar se funciona
    const isValid = await bcrypt.compare(password, hash)
    
    return NextResponse.json({
      password,
      hash,
      isValid,
      sql: `UPDATE users SET password = '${hash}', updated_at = NOW() WHERE email = 'admin@example.com';`
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}