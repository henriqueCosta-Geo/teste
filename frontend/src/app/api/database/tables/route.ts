import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Get all tables from the database
    const tablesResult = await prisma.$queryRaw`
      SELECT
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    ` as any[]

    const tables = []

    for (const tableInfo of tablesResult) {
      const tableName = tableInfo.table_name

      // Get columns for each table
      const columnsResult = await prisma.$queryRaw`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_name = ${tableName}
          AND table_schema = 'public'
        ORDER BY ordinal_position
      ` as any[]

      // Get primary keys
      const primaryKeysResult = await prisma.$queryRaw`
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = ${tableName}
          AND tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
      ` as any[]

      // Get foreign keys
      const foreignKeysResult = await prisma.$queryRaw`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = ${tableName}
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      ` as any[]

      const primaryKeyColumns = primaryKeysResult.map(pk => pk.column_name)

      const foreignKeyMap = new Map()
      foreignKeysResult.forEach(fk => {
        foreignKeyMap.set(fk.column_name, `${fk.foreign_table_name}(${fk.foreign_column_name})`)
      })

      const columns = columnsResult.map(col => ({
        name: col.column_name,
        type: mapPostgresType(col.data_type),
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
        isPrimaryKey: primaryKeyColumns.includes(col.column_name),
        isForeignKey: foreignKeyMap.has(col.column_name),
        references: foreignKeyMap.get(col.column_name)
      }))

      tables.push({
        name: tableName,
        columns
      })
    }

    return NextResponse.json({
      status: 'success',
      message: 'Tables fetched successfully',
      timestamp: new Date().toISOString(),
      tables
    })

  } catch (error) {
    console.error('Error fetching tables:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tables', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper function to map PostgreSQL types to our schema types
function mapPostgresType(pgType: string): string {
  const typeMap: Record<string, string> = {
    'integer': 'integer',
    'bigint': 'bigint',
    'smallint': 'integer',
    'serial': 'serial',
    'bigserial': 'serial',
    'character varying': 'text',
    'varchar': 'text',
    'text': 'text',
    'char': 'text',
    'character': 'text',
    'boolean': 'boolean',
    'timestamp with time zone': 'timestamp',
    'timestamp without time zone': 'timestamp',
    'timestamptz': 'timestamp',
    'timestamp': 'timestamp',
    'date': 'date',
    'time': 'time',
    'json': 'json',
    'jsonb': 'jsonb',
    'numeric': 'numeric',
    'decimal': 'decimal',
    'real': 'float',
    'double precision': 'float',
    'float': 'float',
    'uuid': 'text',
    'bytea': 'text'
  }

  // Handle USER-DEFINED types (enums)
  if (pgType === 'USER-DEFINED') {
    return 'enum'
  }

  const lowerType = pgType.toLowerCase()
  return typeMap[lowerType] || 'text'
}