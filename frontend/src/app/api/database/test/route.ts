import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs'

// Initialize Prisma client with error handling
let prisma: PrismaClient

try {
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  })
} catch (error) {
  console.error('Failed to initialize Prisma client:', error)
}

// GET /api/database/test - Test database connectivity
export async function GET() {
  try {
    // Check if Prisma client was initialized
    if (!prisma) {
      throw new Error('Prisma client not initialized')
    }

    // Test basic connection
    await prisma.$connect()

    // Get database info
    const dbInfo = await prisma.$queryRaw`
      SELECT
        current_database() as database_name,
        current_schema() as schema_name,
        version() as postgres_version
    ` as any[]

    // Get table count
    const tableCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    ` as any[]

    // Get some sample table info
    const sampleTables = await prisma.$queryRaw`
      SELECT
        table_name,
        (
          SELECT COUNT(*)
          FROM information_schema.columns
          WHERE table_name = t.table_name
            AND table_schema = 'public'
        ) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 5
    ` as any[]

    await prisma.$disconnect()

    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      info: {
        database: dbInfo[0],
        tableCount: parseInt(tableCount[0].count),
        sampleTables
      }
    })

  } catch (error) {
    console.error('Database connection error:', error)

    await prisma.$disconnect()

    return NextResponse.json(
      {
        status: 'error',
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}