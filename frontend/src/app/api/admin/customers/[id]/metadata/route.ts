import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

import { prisma } from '@/lib/prisma'

// GET /api/admin/customers/[id]/metadata - Obter metadados TOML do customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Verificar se customer existe
    const customer = await prisma.customers.findUnique({
      where: {
        id: customerId,
        deleted_at: null
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Ler arquivo TOML
    try {
      let tomlContent = ''

      if (customer.metadata_file) {
        const tomlPath = join(process.cwd(), customer.metadata_file)
        tomlContent = await readFile(tomlPath, 'utf-8')
      } else {
        // Se não tem arquivo, gerar template padrão
        tomlContent = generateDefaultToml(customer.slug)
      }

      return NextResponse.json({
        customer: {
          id: customer.id,
          name: customer.name,
          slug: customer.slug
        },
        toml_content: tomlContent,
        file_path: customer.metadata_file
      })

    } catch (fileError) {
      console.error('Erro ao ler arquivo TOML:', fileError)

      // Se não conseguir ler, gerar template padrão
      const defaultToml = generateDefaultToml(customer.slug)

      return NextResponse.json({
        customer: {
          id: customer.id,
          name: customer.name,
          slug: customer.slug
        },
        toml_content: defaultToml,
        file_path: null,
        warning: 'Arquivo de metadados não encontrado. Usando template padrão.'
      })
    }

  } catch (error) {
    console.error('Erro ao obter metadados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/customers/[id]/metadata - Atualizar metadados TOML
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { toml_content } = body

    if (!toml_content) {
      return NextResponse.json(
        { error: 'toml_content é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se customer existe
    const customer = await prisma.customers.findUnique({
      where: {
        id: customerId,
        deleted_at: null
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer não encontrado' }, { status: 404 })
    }

    // Validar TOML básico
    try {
      const lines = toml_content.split('\n')
      const hasValidSections = lines.some((line: string) => line.match(/^\[[\w\.]+\]$/))

      if (!hasValidSections) {
        return NextResponse.json(
          { error: 'TOML deve conter pelo menos uma seção válida' },
          { status: 400 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'TOML inválido' },
        { status: 400 }
      )
    }

    // Criar diretório se não existir
    const metadataDir = join(process.cwd(), 'config', 'customers')
    await mkdir(metadataDir, { recursive: true })

    // Caminho do arquivo
    const tomlPath = join(metadataDir, `${customer.slug}.toml`)
    const relativePath = `config/customers/${customer.slug}.toml`

    // Salvar arquivo
    await writeFile(tomlPath, toml_content, 'utf-8')

    // Atualizar referência no banco se necessário
    if (customer.metadata_file !== relativePath) {
      await prisma.customers.update({
        where: { id: customerId },
        data: {
          metadata_file: relativePath,
          updated_at: new Date()
        }
      })
    }

    return NextResponse.json({
      message: 'Metadados atualizados com sucesso',
      file_path: relativePath,
      updated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Erro ao atualizar metadados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Função para gerar TOML padrão
function generateDefaultToml(customerSlug: string): string {
  return `# Configurações de UI/Interface
[ui]
theme = "light"
logo_path = "/logos/${customerSlug}-logo.png"
primary_color = "#3B82F6"
show_branding = true

# Configurações de Chat
[chat]
has_history = true
max_messages = 100
default_agent = "assistant"
welcome_message = "Olá! Como posso ajudar você hoje?"

# Recursos habilitados
[features]
agents = true
collections = true
teams = true
analytics = true

# Limites padrão
[limits]
max_users = 50
max_agents = 20
max_collections = 100
storage_mb = 10240

# Integrações permitidas
[integrations]
allowed_oauth = ["google", "microsoft", "github"]
webhook_url = ""`
}