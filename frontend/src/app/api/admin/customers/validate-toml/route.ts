import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST /api/admin/customers/validate-toml
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { toml_content } = body

    if (!toml_content) {
      return NextResponse.json(
        { error: 'toml_content é obrigatório' },
        { status: 400 }
      )
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Validações básicas de sintaxe TOML
    try {
      const lines = toml_content.split('\n')
      let currentSection = ''

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        const lineNumber = i + 1

        // Ignorar linhas vazias e comentários
        if (!line || line.startsWith('#')) continue

        // Verificar seções
        if (line.startsWith('[') && line.endsWith(']')) {
          const sectionMatch = line.match(/^\[([^\]]+)\]$/)
          if (!sectionMatch) {
            errors.push(`Linha ${lineNumber}: Seção malformada`)
          } else {
            currentSection = sectionMatch[1]
          }
          continue
        }

        // Verificar pares chave-valor
        if (line.includes('=')) {
          const equalIndex = line.indexOf('=')
          const key = line.substring(0, equalIndex).trim()
          const value = line.substring(equalIndex + 1).trim()

          if (!key) {
            errors.push(`Linha ${lineNumber}: Chave vazia`)
          }

          if (!value) {
            errors.push(`Linha ${lineNumber}: Valor vazio`)
          }

          // Validações específicas por seção
          if (currentSection === 'ui') {
            validateUISection(key, value, lineNumber, errors, warnings)
          } else if (currentSection === 'limits') {
            validateLimitsSection(key, value, lineNumber, errors, warnings)
          } else if (currentSection === 'features') {
            validateFeaturesSection(key, value, lineNumber, errors, warnings)
          } else if (currentSection === 'chat') {
            validateChatSection(key, value, lineNumber, errors, warnings)
          }
        } else if (line) {
          errors.push(`Linha ${lineNumber}: Formato inválido (deve ser chave = valor)`)
        }
      }

      // Verificar seções obrigatórias
      const requiredSections = ['ui', 'features', 'limits']
      const foundSections = extractSections(toml_content)

      for (const section of requiredSections) {
        if (!foundSections.includes(section)) {
          warnings.push(`Seção [${section}] não encontrada - valores padrão serão usados`)
        }
      }

    } catch (parseError) {
      errors.push('Erro de sintaxe TOML')
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      warnings
    })

  } catch (error) {
    console.error('Erro ao validar TOML:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function validateUISection(key: string, value: string, lineNumber: number, errors: string[], warnings: string[]) {
  switch (key) {
    case 'theme':
      if (!['light', 'dark'].includes(value.replace(/"/g, ''))) {
        errors.push(`Linha ${lineNumber}: theme deve ser "light" ou "dark"`)
      }
      break

    case 'primary_color':
      const colorValue = value.replace(/"/g, '')
      if (!colorValue.match(/^#[0-9A-Fa-f]{6}$/)) {
        errors.push(`Linha ${lineNumber}: primary_color deve ser uma cor hexadecimal válida (ex: #3B82F6)`)
      }
      break

    case 'show_branding':
      if (!['true', 'false'].includes(value)) {
        errors.push(`Linha ${lineNumber}: show_branding deve ser true ou false`)
      }
      break

    case 'logo_path':
      const logoPath = value.replace(/"/g, '')
      if (!logoPath.startsWith('/')) {
        warnings.push(`Linha ${lineNumber}: logo_path deve começar com / para ser um caminho absoluto`)
      }
      break
  }
}

function validateLimitsSection(key: string, value: string, lineNumber: number, errors: string[], warnings: string[]) {
  const numericValue = parseInt(value)

  switch (key) {
    case 'max_users':
    case 'max_agents':
    case 'max_collections':
      if (isNaN(numericValue)) {
        errors.push(`Linha ${lineNumber}: ${key} deve ser um número`)
      } else if (numericValue < -1) {
        errors.push(`Linha ${lineNumber}: ${key} deve ser -1 (ilimitado) ou um número positivo`)
      } else if (numericValue === 0) {
        warnings.push(`Linha ${lineNumber}: ${key} = 0 impedirá a criação de novos recursos`)
      }
      break

    case 'storage_mb':
      if (isNaN(numericValue)) {
        errors.push(`Linha ${lineNumber}: storage_mb deve ser um número`)
      } else if (numericValue <= 0) {
        errors.push(`Linha ${lineNumber}: storage_mb deve ser um número positivo`)
      } else if (numericValue < 100) {
        warnings.push(`Linha ${lineNumber}: storage_mb muito baixo (${numericValue}MB)`)
      }
      break
  }
}

function validateFeaturesSection(key: string, value: string, lineNumber: number, errors: string[], warnings: string[]) {
  const validFeatures = ['agents', 'collections', 'teams', 'analytics']

  if (!validFeatures.includes(key)) {
    warnings.push(`Linha ${lineNumber}: Feature '${key}' não é reconhecida`)
  }

  if (!['true', 'false'].includes(value)) {
    errors.push(`Linha ${lineNumber}: ${key} deve ser true ou false`)
  }
}

function validateChatSection(key: string, value: string, lineNumber: number, errors: string[], warnings: string[]) {
  switch (key) {
    case 'has_history':
      if (!['true', 'false'].includes(value)) {
        errors.push(`Linha ${lineNumber}: has_history deve ser true ou false`)
      }
      break

    case 'max_messages':
      const maxMessages = parseInt(value)
      if (isNaN(maxMessages)) {
        errors.push(`Linha ${lineNumber}: max_messages deve ser um número`)
      } else if (maxMessages <= 0) {
        errors.push(`Linha ${lineNumber}: max_messages deve ser um número positivo`)
      } else if (maxMessages > 1000) {
        warnings.push(`Linha ${lineNumber}: max_messages muito alto (${maxMessages}) pode impactar performance`)
      }
      break

    case 'welcome_message':
      const message = value.replace(/"/g, '')
      if (message.length > 200) {
        warnings.push(`Linha ${lineNumber}: welcome_message muito longa (${message.length} caracteres)`)
      }
      break
  }
}

function extractSections(tomlContent: string): string[] {
  const sections: string[] = []
  const lines = tomlContent.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
      if (sectionMatch) {
        sections.push(sectionMatch[1])
      }
    }
  }

  return sections
}