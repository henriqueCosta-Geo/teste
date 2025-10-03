import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Teste de conexão básica
    const customerCount = await prisma.customers.count()
    const userCount = await prisma.users.count()
    
    // Criar customer demo se não existir
    let customer = await prisma.customers.findUnique({
      where: { slug: 'demo' }
    })
    
    if (!customer) {
      customer = await prisma.customers.create({
        data: {
          name: 'Empresa Demo',
          slug: 'demo',
          metadata_file: null, // Sem arquivo TOML por padrão
          is_active: true
        }
      })
    }
    
    // Criar usuário admin se não existir
    let user = await prisma.users.findUnique({
      where: { email: 'admin@example.com' }
    })
    
    if (!user) {
      const hashedPassword = await bcrypt.hash('admin123', 12)
      user = await prisma.users.create({
        data: {
          name: 'Administrador',
          email: 'admin@example.com',
          username: 'admin',
          password: hashedPassword,
          role: 'ADMIN',
          customer_id: customer.id,
          is_active: true
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      database: 'connected',
      customers: customerCount,
      users: userCount,
      demo_user_created: !!user,
      customer_created: !!customer
    })
    
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { 
        error: 'Database connection failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}