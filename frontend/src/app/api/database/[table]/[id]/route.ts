import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, Prisma } from '@prisma/client'

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs'

// Initialize Prisma client with error handling
let prisma: PrismaClient

try {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  })
} catch (error) {
  console.error('Failed to initialize Prisma client:', error)
}

// PUT /api/database/[table]/[id] - Update record
export async function PUT(
  request: NextRequest,
  { params }: { params: { table: string; id: string } }
) {
  try {
    // Check if Prisma client was initialized
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database client not initialized' },
        { status: 500 }
      )
    }
    const { table, id } = params
    const data = await request.json()

    // Validate table name by checking if it exists in database
    const tableExistsResult = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ${table}
    ` as any[]

    if (tableExistsResult.length === 0) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    const recordId = parseInt(id)
    if (isNaN(recordId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    // Build dynamic update query
    const columns = Object.keys(data)
    const values = Object.values(data)

    // Create SET clause with placeholders
    const setPairs = columns.map((col, index) => `"${col}" = $${index + 1}`).join(', ')

    const result = await prisma.$queryRawUnsafe(
      `UPDATE "${table}" SET ${setPairs} WHERE id = $${columns.length + 1} RETURNING *`,
      ...values,
      recordId
    )

    return NextResponse.json(result)

  } catch (error) {
    console.error('Update record error:', error)
    return NextResponse.json(
      { error: 'Failed to update record' },
      { status: 500 }
    )
  }
}

// DELETE /api/database/[table]/[id] - Delete record
export async function DELETE(
  request: NextRequest,
  { params }: { params: { table: string; id: string } }
) {
  try {
    // Check if Prisma client was initialized
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database client not initialized' },
        { status: 500 }
      )
    }
    const { table, id } = params

    // Validate table name by checking if it exists in database
    const tableExistsResult = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ${table}
    ` as any[]

    if (tableExistsResult.length === 0) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    const recordId = parseInt(id)
    if (isNaN(recordId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    // Build dynamic delete query
    const result = await prisma.$queryRawUnsafe(
      `DELETE FROM "${table}" WHERE id = $1 RETURNING *`,
      recordId
    )

    return NextResponse.json({ success: true, deleted: result })

  } catch (error) {
    console.error('Delete record error:', error)

    // Check if it's a foreign key constraint error
    if (error instanceof Error && error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Cannot delete record: it is referenced by other records' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete record' },
      { status: 500 }
    )
  }
}

// GET /api/database/[table]/[id] - Get single record
export async function GET(
  request: NextRequest,
  { params }: { params: { table: string; id: string } }
) {
  try {
    // Check if Prisma client was initialized
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database client not initialized' },
        { status: 500 }
      )
    }
    const { table, id } = params

    // Validate table name by checking if it exists in database
    const tableExistsResult = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ${table}
    ` as any[]

    if (tableExistsResult.length === 0) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      )
    }

    const recordId = parseInt(id)
    if (isNaN(recordId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      )
    }

    // Build dynamic select query
    const queryResult = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${table}" WHERE id = $1`,
      recordId
    ) as any[]

    const result = queryResult[0] || null

    if (!result) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Get record error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch record' },
      { status: 500 }
    )
  }
}