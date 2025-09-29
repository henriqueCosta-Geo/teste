import { Collection, File as FileRecord, Agent, SearchResult, SystemStatus, FilePreview, ChatMessage, Customer, CreateCustomerRequest } from './types'

// Base URL - teste direto com backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Função auxiliar para lidar com erros
async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text()
    console.error('API Error:', errorText)
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return await response.json()
  }
  return await response.text()
}

// Função auxiliar para fazer requisições
async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// ============================================================================
// SYSTEM APIs
// ============================================================================

export const systemAPI = {
  getStatus: async (): Promise<SystemStatus> => {
    const response = await fetchWithTimeout(`/api/proxy/status`)
    return await handleResponse(response)
  }
}

// ============================================================================
// COLLECTIONS APIs
// ============================================================================

export const collectionsAPI = {
  list: async (): Promise<Collection[]> => {
    const response = await fetchWithTimeout(`/api/proxy/collections`)
    return await handleResponse(response)
  },

  get: async (id: number): Promise<Collection> => {
    const response = await fetchWithTimeout(`/api/proxy/collections/${id}`)
    return await handleResponse(response)
  },

  create: async (collection: Omit<Collection, 'id' | 'files_count' | 'chunks_count' | 'created_at'>): Promise<Collection> => {
    const response = await fetchWithTimeout(`/api/proxy/collections`, {
      method: 'POST',
      body: JSON.stringify(collection),
    })
    return await handleResponse(response)
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetchWithTimeout(`/api/proxy/collections/${id}`, {
      method: 'DELETE',
    })
    await handleResponse(response)
  },

  uploadFile: async (collectionId: number, file: File): Promise<{ message: string; file_id: number }> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetchWithTimeout(`/api/proxy/collections/${collectionId}/upload`, {
      method: 'POST',
      headers: {}, // Let fetch set Content-Type for FormData
      body: formData,
    })
    return await handleResponse(response)
  },

  search: async (collectionId: number, query: string, limit: number = 5): Promise<{
    query: string
    collection: string
    results: SearchResult[]
  }> => {
    const formData = new FormData()
    formData.append('query', query)
    formData.append('limit', limit.toString())
    
    const response = await fetchWithTimeout(`/api/proxy/collections/${collectionId}/search`, {
      method: 'POST',
      headers: {}, // Let fetch set Content-Type for FormData
      body: formData,
    })
    return await handleResponse(response)
  },

  getFiles: async (collectionId: number): Promise<FileRecord[]> => {
    const response = await fetchWithTimeout(`/api/proxy/collections/${collectionId}/files`)
    return await handleResponse(response)
  }
}

// ============================================================================
// FILES APIs
// ============================================================================

export const filesAPI = {
  process: async (fileId: number, chunkSize: number = 1000, chunkOverlap: number = 100): Promise<{
    message: string
    chunks_created: number
    chunk_stats: any
  }> => {
    const formData = new FormData()
    formData.append('chunk_size', chunkSize.toString())
    formData.append('chunk_overlap', chunkOverlap.toString())
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/files/${fileId}/process`, {
      method: 'POST',
      headers: {}, // Let fetch set Content-Type for FormData
      body: formData,
    })
    return await handleResponse(response)
  },

  preview: async (fileId: number): Promise<FilePreview> => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/files/${fileId}/preview`)
    return await handleResponse(response)
  },

  delete: async (fileId: number): Promise<void> => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
    })
    await handleResponse(response)
  }
}

// ============================================================================
// AGENTS APIs
// ============================================================================

export const agentsAPI = {
  list: async (includeCollections: boolean = true): Promise<Agent[]> => {
    const params = new URLSearchParams({ include_collections: includeCollections.toString() })
    const response = await fetchWithTimeout(`/api/agents?${params}`)
    return await handleResponse(response)
  },

  get: async (id: number): Promise<Agent> => {
    const response = await fetchWithTimeout(`/api/proxy/api/agents/${id}`)
    return await handleResponse(response)
  },

  create: async (agent: {
    name: string
    description?: string
    role?: string
    model?: string
    temperature?: number
    instructions?: string
    tools_config?: string[]
  }): Promise<{ id: number; message: string }> => {
    const requestBody = {
      name: agent.name.trim(),
      description: agent.description?.trim() || "",
      role: agent.role?.trim() || "",
      model: agent.model || 'gpt-4o-mini',
      temperature: agent.temperature || 0.7,
      instructions: agent.instructions?.trim() || "",
      tools_config: agent.tools_config || ['rag']
    }

    console.log('Dados sendo enviados para criação de agente:', requestBody)

    const response = await fetchWithTimeout(`/api/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    return await handleResponse(response)
  },

  update: async (id: number, formData: FormData): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(`/api/proxy/api/agents/${id}`, {
      method: 'PUT',
      headers: {}, // Let fetch set Content-Type for FormData
      body: formData,
    })
    return await handleResponse(response)
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetchWithTimeout(`/api/proxy/api/agents/${id}`, {
      method: 'DELETE',
    })
    await handleResponse(response)
  },

  chat: async (agentId: number, message: string, sessionId?: string): Promise<{
    response?: string
    team_response?: string
    tools_used?: string[]
    execution_time_ms?: number
    success?: boolean
  }> => {
    if (!agentId || isNaN(agentId)) {
      throw new Error('ID do agente inválido')
    }
    if (!message?.trim()) {
      throw new Error('Mensagem não pode estar vazia')
    }
    
    const requestBody = {
      message: message.trim(),
      session_id: sessionId || undefined
    }
    
    console.log('API: Enviando chat para agente', agentId, 'com dados:', requestBody)
    console.log('- URL:', `/api/proxy/api/agents/${agentId}/chat`)
    
    const response = await fetchWithTimeout(`/api/proxy/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    
    const data = await handleResponse(response)
    console.log('API: Resposta do chat recebida:', data)
    
    return data
  },

  assignCollection: async (agentId: number, data: {
    collection_id: number
    access_level: string
    priority: number
  }): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(`/api/proxy/api/agents/${agentId}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return await handleResponse(response)
  },

  removeCollection: async (agentId: number, collectionId: number): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(`/api/proxy/api/agents/${agentId}/collections/${collectionId}`, {
      method: 'DELETE',
    })
    return await handleResponse(response)
  }
}

// ============================================================================
// TEAMS APIs
// ============================================================================

export const teamsAPI = {
  create: async (team: {
    name: string
    description?: string
    leader_agent_id?: number
    member_ids: number[]
  }): Promise<{ id: number; message: string }> => {
    const requestBody = {
      name: team.name.trim(),
      description: team.description?.trim() || undefined,
      leader_agent_id: team.leader_agent_id || undefined,
      member_ids: team.member_ids
    }

    console.log('Dados sendo enviados para criação de time:', requestBody)

    const response = await fetchWithTimeout(`/api/proxy/api/teams/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    return await handleResponse(response)
  },

  list: async (): Promise<any[]> => {
    console.log('API: Listando times')
    const response = await fetchWithTimeout(`/api/proxy/api/teams/`)
    const data = await handleResponse(response)
    console.log('API: Times recebidos:', data)
    return Array.isArray(data) ? data : []
  },

  delete: async (id: number): Promise<{ message: string }> => {
    console.log('API: Deletando time ID:', id)
    const response = await fetchWithTimeout(`/api/proxy/api/teams/${id}`, {
      method: 'DELETE',
    })
    return await handleResponse(response)
  },

  get: async (id: number): Promise<any> => {
    console.log('API: Buscando time ID:', id)
    const response = await fetchWithTimeout(`/api/proxy/api/teams/${id}`)
    const data = await handleResponse(response)
    console.log('API: Time recebido:', data)
    return data
  },

  execute: async (teamId: number, task: string, sessionId: string): Promise<any> => {
    console.log('API: Executando tarefa com time ID:', teamId)

    const requestBody = {
      task: task,
      session_id: sessionId
    }

    const response = await fetchWithTimeout(`/api/proxy/api/teams/${teamId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const data = await handleResponse(response)
    console.log('API: Resposta da execução do time:', data)
    return data
  },

  executeStream: async (teamId: number, task: string, sessionId: string, onChunk: (chunk: any) => void): Promise<void> => {
    console.log('API: Executando tarefa com streaming para time ID:', teamId)

    const formData = new FormData()
    formData.append('task', task)
    formData.append('session_id', sessionId)
    formData.append('stream', 'true')

    const response = await fetch(`/api/proxy/api/teams/${teamId}/execute`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Stream não disponível')
    }

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onChunk(data)
            } catch (e) {
              console.warn('Erro ao parsear chunk:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

// ============================================================================
// CUSTOMERS APIs (Admin)
// ============================================================================

export const customersAPI = {
  list: async (): Promise<Customer[]> => {
    const response = await fetchWithTimeout(`/api/admin/customers`)
    const data = await handleResponse(response)
    return Array.isArray(data) ? data : []
  },

  get: async (id: number): Promise<Customer> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${id}`)
    return await handleResponse(response)
  },

  create: async (customer: CreateCustomerRequest): Promise<{ id: number; message: string }> => {
    console.log('Criando customer:', customer)

    const response = await fetchWithTimeout(`/api/admin/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    })
    return await handleResponse(response)
  },

  update: async (id: number, customer: Partial<CreateCustomerRequest>): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    })
    return await handleResponse(response)
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${id}`, {
      method: 'DELETE',
    })
    return await handleResponse(response)
  },

  validateSlug: async (slug: string): Promise<{ available: boolean }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/validate-slug?slug=${encodeURIComponent(slug)}`)
    return await handleResponse(response)
  },

  validateToml: async (tomlContent: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[]
  }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/validate-toml`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toml_content: tomlContent }),
    })
    return await handleResponse(response)
  },

  simulate: async (customerData: CreateCustomerRequest): Promise<{
    success: boolean;
    results: Array<{
      step: string;
      success: boolean;
      message: string;
      duration_ms: number;
    }>
  }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    })
    return await handleResponse(response)
  },

  // Users management for a customer
  getUsers: async (customerId: number): Promise<any[]> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${customerId}/users`)
    return await handleResponse(response)
  },

  createUser: async (customerId: number, userData: {
    name: string;
    email: string;
    username: string;
    password: string;
    role: 'USER' | 'ADMIN';
  }): Promise<{ id: number; message: string }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${customerId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })
    return await handleResponse(response)
  },

  // Metadata management
  getMetadata: async (customerId: number): Promise<{ toml_content: string }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${customerId}/metadata`)
    return await handleResponse(response)
  },

  updateMetadata: async (customerId: number, tomlContent: string): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(`/api/admin/customers/${customerId}/metadata`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toml_content: tomlContent }),
    })
    return await handleResponse(response)
  }
}