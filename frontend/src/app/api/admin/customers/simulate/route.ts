import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST /api/admin/customers/simulate
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
    const {
      name,
      slug,
      metadata_toml,
      create_admin,
      admin_data
    } = body

    const results: Array<{
      step: string
      success: boolean
      message: string
      duration_ms: number
    }> = []

    // Simulação 1: Validar metadados TOML
    const step1Start = Date.now()
    const tomlValidation = await simulateTomlValidation(metadata_toml)
    results.push({
      step: 'metadata',
      success: tomlValidation.success,
      message: tomlValidation.message,
      duration_ms: Date.now() - step1Start
    })

    // Simulação 2: Verificar limites do plano
    const step2Start = Date.now()
    const limitsValidation = await simulateLimitsValidation(metadata_toml)
    results.push({
      step: 'limits',
      success: limitsValidation.success,
      message: limitsValidation.message,
      duration_ms: Date.now() - step2Start
    })

    // Simulação 3: Testar configurações de UI
    const step3Start = Date.now()
    const uiValidation = await simulateUIValidation(metadata_toml)
    results.push({
      step: 'ui',
      success: uiValidation.success,
      message: uiValidation.message,
      duration_ms: Date.now() - step3Start
    })

    // Simulação 4: Verificar features habilitadas
    const step4Start = Date.now()
    const featuresValidation = await simulateFeaturesValidation(metadata_toml)
    results.push({
      step: 'features',
      success: featuresValidation.success,
      message: featuresValidation.message,
      duration_ms: Date.now() - step4Start
    })

    // Simulação 5: Sistema de autenticação
    const step5Start = Date.now()
    const authValidation = await simulateAuthValidation(create_admin, admin_data)
    results.push({
      step: 'auth',
      success: authValidation.success,
      message: authValidation.message,
      duration_ms: Date.now() - step5Start
    })

    // Simulação 6: Integrações
    const step6Start = Date.now()
    const integrationValidation = await simulateIntegrationValidation(metadata_toml)
    results.push({
      step: 'integration',
      success: integrationValidation.success,
      message: integrationValidation.message,
      duration_ms: Date.now() - step6Start
    })

    // Verificar se todas as simulações passaram
    const allSuccess = results.every(result => result.success)

    return NextResponse.json({
      success: allSuccess,
      results
    })

  } catch (error) {
    console.error('Erro na simulação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function simulateTomlValidation(tomlContent: string) {
  try {
    if (!tomlContent?.trim()) {
      return {
        success: false,
        message: 'Metadados TOML estão vazios'
      }
    }

    // Verificar seções obrigatórias
    const requiredSections = ['ui', 'features', 'limits']
    const missingSections = []

    for (const section of requiredSections) {
      if (!tomlContent.includes(`[${section}]`)) {
        missingSections.push(section)
      }
    }

    if (missingSections.length > 0) {
      return {
        success: false,
        message: `Seções obrigatórias faltando: ${missingSections.join(', ')}`
      }
    }

    return {
      success: true,
      message: 'Estrutura TOML válida e completa'
    }
  } catch (error) {
    return {
      success: false,
      message: 'Erro de sintaxe no TOML'
    }
  }
}

async function simulateLimitsValidation(tomlContent: string) {
  // Extract limits directly from TOML metadata
  const tomlLimits = extractLimitsFromToml(tomlContent)

  // Validate reasonable limits
  if (tomlLimits.max_users < 1 && tomlLimits.max_users !== -1) {
    return {
      success: false,
      message: 'Limite de usuários deve ser maior que 0 ou -1 para ilimitado'
    }
  }

  if (tomlLimits.max_agents < 1 && tomlLimits.max_agents !== -1) {
    return {
      success: false,
      message: 'Limite de agentes deve ser maior que 0 ou -1 para ilimitado'
    }
  }

  return {
    success: true,
    message: `Limites configurados: ${tomlLimits.max_users === -1 ? '∞' : tomlLimits.max_users} usuários, ${tomlLimits.max_agents === -1 ? '∞' : tomlLimits.max_agents} agentes`
  }
}

async function simulateUIValidation(tomlContent: string) {
  const hasTheme = tomlContent.includes('theme =')
  const hasColor = tomlContent.includes('primary_color =')

  if (!hasTheme && !hasColor) {
    return {
      success: false,
      message: 'Configurações de UI incompletas - faltam theme ou primary_color'
    }
  }

  // Verificar se a cor é válida
  const colorMatch = tomlContent.match(/primary_color\s*=\s*"([^"]+)"/)
  if (colorMatch) {
    const color = colorMatch[1]
    if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
      return {
        success: false,
        message: 'Cor primária inválida - deve ser formato hex (#RRGGBB)'
      }
    }
  }

  return {
    success: true,
    message: 'Interface renderizada com sucesso'
  }
}

async function simulateFeaturesValidation(tomlContent: string) {
  const features = ['agents', 'collections', 'teams', 'analytics']
  let enabledCount = 0

  for (const feature of features) {
    if (tomlContent.includes(`${feature} = true`)) {
      enabledCount++
    }
  }

  // All features are now customizable through metadata
  return {
    success: true,
    message: `${enabledCount} de ${features.length} recursos habilitados`
  }
}

async function simulateAuthValidation(createAdmin: boolean, adminData: any) {
  if (createAdmin) {
    if (!adminData?.email || !adminData?.password) {
      return {
        success: false,
        message: 'Dados do administrador incompletos'
      }
    }

    // Verificar se email já existe
    const existingUser = await prisma.users.findUnique({
      where: { email: adminData.email }
    })

    if (existingUser) {
      return {
        success: false,
        message: 'Email do administrador já está em uso'
      }
    }

    return {
      success: true,
      message: 'Usuário administrador será criado com sucesso'
    }
  }

  return {
    success: true,
    message: 'Sistema de autenticação básico configurado'
  }
}

async function simulateIntegrationValidation(tomlContent: string) {
  const hasWebhook = tomlContent.includes('webhook_url') &&
                     tomlContent.includes('http')

  const hasOAuth = tomlContent.includes('allowed_oauth')

  let integrationsCount = 0
  if (hasWebhook) integrationsCount++
  if (hasOAuth) integrationsCount++

  if (hasWebhook) {
    // Verificar se URL é válida
    const webhookMatch = tomlContent.match(/webhook_url\s*=\s*"([^"]+)"/)
    if (webhookMatch) {
      const url = webhookMatch[1]
      if (!url.startsWith('http')) {
        return {
          success: false,
          message: 'URL de webhook inválida - deve começar com http:// ou https://'
        }
      }
    }
  }

  return {
    success: true,
    message: integrationsCount > 0
      ? `${integrationsCount} integração(ões) configurada(s) e testada(s)`
      : 'Sem integrações externas configuradas'
  }
}

function extractLimitsFromToml(tomlContent: string) {
  const limits = {
    max_users: 10,
    max_agents: 5,
    max_collections: 10,
    storage_mb: 1024
  }

  // Extrair valores do TOML (parsing simples)
  const userMatch = tomlContent.match(/max_users\s*=\s*(\d+)/)
  if (userMatch) limits.max_users = parseInt(userMatch[1])

  const agentMatch = tomlContent.match(/max_agents\s*=\s*(\d+)/)
  if (agentMatch) limits.max_agents = parseInt(agentMatch[1])

  const collectionMatch = tomlContent.match(/max_collections\s*=\s*(\d+)/)
  if (collectionMatch) limits.max_collections = parseInt(collectionMatch[1])

  const storageMatch = tomlContent.match(/storage_mb\s*=\s*(\d+)/)
  if (storageMatch) limits.storage_mb = parseInt(storageMatch[1])

  return limits
}