import { PrismaClient } from "@prisma/client"
import { readFile } from "fs/promises"
import { parse as parseToml } from "@iarna/toml"
import { CustomerMetadata } from "./types"

const prisma = new PrismaClient()

export class MetadataOrchestrator {
  private static cache = new Map<string, CustomerMetadata>()

  static async getCustomerMetadata(customerSlug: string): Promise<CustomerMetadata> {
    // Verificar cache primeiro
    if (this.cache.has(customerSlug)) {
      return this.cache.get(customerSlug)!
    }

    try {
      const customer = await prisma.customers.findUnique({
        where: { slug: customerSlug, is_active: true, deleted_at: null }
      })

      if (!customer) {
        throw new Error(`Customer ${customerSlug} não encontrado`)
      }

      let metadata: CustomerMetadata = this.getDefaultMetadata()

      // Ler metadados TOML do banco de dados
      if (customer.metadata_toml) {
        try {
          const parsedMetadata = parseToml(customer.metadata_toml) as CustomerMetadata
          // Mesclar com padrões
          metadata = { ...metadata, ...parsedMetadata }
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear TOML para ${customerSlug}, usando configurações padrão`)
        }
      } else if (customer.metadata_file && customer.metadata_file.trim()) {
        // Fallback: tentar ler do arquivo (compatibilidade com dados antigos)
        try {
          const metadataContent = await readFile(customer.metadata_file, "utf-8")
          const parsedMetadata = parseToml(metadataContent) as CustomerMetadata
          metadata = { ...metadata, ...parsedMetadata }
        } catch (fileError) {
          console.warn(`⚠️ Arquivo TOML legado não encontrado para ${customerSlug}, usando configurações padrão`)
        }
      }

      // Armazenar no cache
      this.cache.set(customerSlug, metadata)

      return metadata
    } catch (error) {
      console.error(`Erro ao carregar metadados para ${customerSlug}:`, error)
      return this.getDefaultMetadata()
    }
  }

  static async getUserPermissions(userId: number) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        customer: true
      }
    })

    if (!user) {
      throw new Error("Usuário não encontrado")
    }

    const metadata = await this.getCustomerMetadata(user.customer.slug)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customer_slug: user.customer.slug,
        customer_plan: 'CUSTOM' // Metadata-driven plan
      },
      permissions: {
        can_manage_agents: user.role !== "USER" || metadata.features?.agents !== false,
        can_manage_collections: user.role !== "USER" || metadata.features?.collections !== false,
        can_manage_teams: user.role !== "USER" || metadata.features?.teams !== false,
        can_view_analytics: user.role !== "USER" || metadata.features?.analytics !== false,
        can_manage_users: ["ADMIN", "SUPER_USER"].includes(user.role),
        can_manage_settings: ["ADMIN", "SUPER_USER"].includes(user.role)
      },
      limits: metadata.limits || {},
      ui: metadata.ui || {},
      chat: metadata.chat || {}
    }
  }

  static async validateUserAction(
    userId: number,
    action: string,
    resourceType?: string,
    currentCount?: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const userPerms = await this.getUserPermissions(userId)

    switch (action) {
      case "create_agent":
        if (!userPerms.permissions.can_manage_agents) {
          return { allowed: false, reason: "Sem permissão para gerenciar agentes" }
        }
        if (userPerms.limits.max_agents && currentCount && currentCount >= userPerms.limits.max_agents) {
          return { allowed: false, reason: `Limite de ${userPerms.limits.max_agents} agentes atingido` }
        }
        break

      case "create_collection":
        if (!userPerms.permissions.can_manage_collections) {
          return { allowed: false, reason: "Sem permissão para gerenciar coleções" }
        }
        if (userPerms.limits.max_collections && currentCount && currentCount >= userPerms.limits.max_collections) {
          return { allowed: false, reason: `Limite de ${userPerms.limits.max_collections} coleções atingido` }
        }
        break

      case "create_user":
        if (!userPerms.permissions.can_manage_users) {
          return { allowed: false, reason: "Sem permissão para gerenciar usuários" }
        }
        if (userPerms.limits.max_users && currentCount && currentCount >= userPerms.limits.max_users) {
          return { allowed: false, reason: `Limite de ${userPerms.limits.max_users} usuários atingido` }
        }
        break

      default:
        return { allowed: true }
    }

    return { allowed: true }
  }

  private static getDefaultMetadata(): CustomerMetadata {
    return {
      ui: {
        theme: "light",
        show_branding: true
      },
      chat: {
        has_history: true,
        max_messages: 100
      },
      features: {
        agents: true,
        collections: true,
        teams: false,
        analytics: false
      },
      limits: {
        max_users: 10,
        max_agents: 5,
        max_collections: 10,
        storage_mb: 1000
      }
    }
  }

  // Limpar cache quando necessário
  static clearCache(customerSlug?: string) {
    if (customerSlug) {
      this.cache.delete(customerSlug)
    } else {
      this.cache.clear()
    }
  }
}