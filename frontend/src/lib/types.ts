// Tipos baseados no backend FastAPI

export interface Collection {
  id: number
  name: string
  description?: string
  vector_size: number
  distance_metric: string
  files_count: number
  chunks_count: number
  created_at: string
  updated_at?: string
}

export interface File {
  id: number
  filename: string
  original_name: string
  file_type: 'pdf' | 'txt' | 'docx' | 'md'
  file_size: number
  processed: boolean
  collection_id: number
  created_at: string
}

export interface Agent {
  id: number
  name: string
  description?: string
  role?: string
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo'
  temperature: number
  instructions?: string
  tools_config: string[]
  is_active: boolean
  created_at: string
  collections?: CollectionAssignment[]
}

export interface CollectionAssignment {
  id: number
  name: string
  access_level: 'read' | 'write' | 'admin'
  priority: number
}

export interface SearchResult {
  point_id: string
  score: number
  content: string
  file_id: number
  file_name: string
  chunk_index: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tools_used?: string[]
  execution_time_ms?: number
}

export interface SystemStatus {
  status: 'online' | 'error'
  qdrant_connected: boolean
  qdrant_collections: string[]
  error?: string
}

export interface FilePreview {
  file_info: {
    id: number
    original_name: string
    file_type: string
    file_size: number
    processed: boolean
  }
  original_content: {
    text: string
    preview: string
    stats: {
      length: number
      lines: number
      words: number
      paragraphs: number
    }
  }
  chunks: {
    index: number
    content: string
    length: number
    qdrant_point_id: string
  }[]
  chunk_stats: {
    total_chunks: number
    avg_length: number
    min_length: number
    max_length: number
  }
}

// Customer Management Types
export interface Customer {
  id: number
  name: string
  slug: string
  is_active: boolean
  metadata_file?: string // DEPRECATED
  metadata_toml?: string // Conteúdo TOML armazenado no banco
  users_count?: number
  agents_count?: number
  collections_count?: number
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface CreateCustomerRequest {
  name: string
  slug: string
  description?: string
  metadata_toml: string
  create_admin: boolean
  admin_data?: {
    name: string
    email: string
    username: string
    password: string
  }
}

export interface CustomerMetadata {
  ui?: {
    theme?: string
    logo_path?: string
    primary_color?: string
    show_branding?: boolean
  }
  chat?: {
    has_history?: boolean
    max_messages?: number
    default_agent?: string
    default_team?: string
    welcome_message?: string
  }
  features?: {
    agents?: boolean
    collections?: boolean
    teams?: boolean
    analytics?: boolean
  }
  limits?: {
    max_users?: number
    max_agents?: number
    max_collections?: number
    storage_mb?: number
  }
  integrations?: {
    allowed_oauth?: string[]
    webhook_url?: string
    api_keys?: Record<string, string>
  }
}

export interface User {
  id: number
  name: string
  email: string
  username: string
  role: 'USER' | 'ADMIN' | 'SUPER_USER'
  customer_id: number
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}