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

// GET /api/database/[table] - Get table data with pagination and search
export async function GET(
  request: NextRequest,
  { params }: { params: { table: string } }
) {
  try {
    // Check if Prisma client was initialized
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database client not initialized' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    const { table } = params
    const offset = (page - 1) * limit

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

    // Get table data using Prisma's raw queries since we need dynamic table names
    let whereClause = ''
    let countWhereClause = ''

    if (search) {
      // Build search condition based on table structure
      const searchConditions = getSearchConditions(table, search)
      whereClause = searchConditions ? `WHERE ${searchConditions}` : ''
      countWhereClause = whereClause
    }

    // Get total count
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM ${Prisma.raw(`"${table}"`)}
      ${whereClause ? Prisma.raw(whereClause) : Prisma.empty}
    ` as any[]

    const totalCount = parseInt(countResult[0].count)

    // Get primary key column to use for ordering
    const primaryKeyResult = await prisma.$queryRaw`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = ${table}
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      LIMIT 1
    ` as any[]

    const orderByColumn = primaryKeyResult.length > 0 ? primaryKeyResult[0].column_name : 'ctid'

    // Get paginated data
    const rows = await prisma.$queryRaw`
      SELECT * FROM ${Prisma.raw(`"${table}"`)}
      ${whereClause ? Prisma.raw(whereClause) : Prisma.empty}
      ORDER BY ${Prisma.raw(`"${orderByColumn}"`)}
      LIMIT ${limit} OFFSET ${offset}
    ` as any[]

    // Get table columns
    const columns = await getTableColumns(table)

    return NextResponse.json({
      columns,
      rows,
      totalCount
    })

  } catch (error) {
    console.error('Database query error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

// POST /api/database/[table] - Create new record
export async function POST(
  request: NextRequest,
  { params }: { params: { table: string } }
) {
  try {
    // Check if Prisma client was initialized
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database client not initialized' },
        { status: 500 }
      )
    }

    const { table } = params
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

    // Build dynamic insert query
    const columns = Object.keys(data)
    const values = Object.values(data)

    // Create placeholders for the values
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
    const columnNames = columns.map(col => `"${col}"`).join(', ')

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders}) RETURNING *`,
      ...values
    )

    return NextResponse.json(result)

  } catch (error) {
    console.error('Create record error:', error)
    return NextResponse.json(
      { error: 'Failed to create record' },
      { status: 500 }
    )
  }
}

// Helper function to get search conditions for different tables
function getSearchConditions(table: string, search: string): string {
  const searchTerm = `%${search}%`

  switch (table) {
    case 'customers':
      return `name ILIKE '${searchTerm}' OR slug ILIKE '${searchTerm}'`
    case 'users':
      return `name ILIKE '${searchTerm}' OR email ILIKE '${searchTerm}' OR username ILIKE '${searchTerm}'`
    case 'collections':
      return `name ILIKE '${searchTerm}' OR description ILIKE '${searchTerm}'`
    case 'agents':
      return `name ILIKE '${searchTerm}' OR description ILIKE '${searchTerm}' OR role ILIKE '${searchTerm}'`
    case 'files':
      return `filename ILIKE '${searchTerm}' OR original_name ILIKE '${searchTerm}'`
    case 'chat_sessions':
      return `session_id ILIKE '${searchTerm}'`
    case 'chat_messages':
      return `content ILIKE '${searchTerm}'`
    default:
      return ''
  }
}

// Helper function to get table columns
async function getTableColumns(table: string): Promise<string[]> {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = ${table}
        AND table_schema = 'public'
      ORDER BY ordinal_position
    ` as any[]

    return result.map(row => row.column_name)
  } catch (error) {
    console.error('Error getting table columns:', error)
    return []
  }
}