/**
 * Tipos TypeScript para Dashboard de Administração
 */

export interface OverviewMetrics {
  customer_id: number
  customer_name: string
  plan_type: string
  total_users: number
  active_users: number
  total_chats: number
  total_messages: number
  period_days: number
}

export interface TokenByModel {
  [model: string]: {
    tokens: number
    messages: number
    cost: number
  }
}

export interface AgentTokens {
  agent_id: number
  tokens: number
  messages: number
  agent_name: string
  team_name?: string
  avg_tokens_per_message: number
}

export interface TokenConsumption {
  total_tokens: number
  input_tokens: number
  output_tokens: number
  by_model: TokenByModel
  by_agent: AgentTokens[]
  estimated_cost: number
}

export interface AgentPerformance {
  agent_id: number
  agent_name: string
  agent_model: string
  team_name?: string
  total_messages: number
  avg_execution_time_ms: number
  success_rate: number
  errors: number
  rag_usage_rate: number
  avg_chunks_per_query: number
  collections_count: number
}

export interface UserActivity {
  user_id: number
  user_name: string
  user_email: string
  chats_started: number
  messages_sent: number
  last_active?: string
  favorite_team?: string
}

export interface TeamUsage {
  team_id: number
  team_name: string
  usage_count: number
  unique_users: number
}

export interface ConversationInsights {
  total_chats: number
  avg_messages_per_chat: number
  users_activity: UserActivity[]
  top_teams: TeamUsage[]
}

export interface RAGSource {
  collection: string
  queries: number
  avg_score: number
  agents_using: number[]
}

export interface CollectionStats {
  collection_id: number
  collection_name: string
  files_count: number
  chunks_count: number
  rag_queries: number
  avg_chunks_per_query: number
}

export interface RAGAnalytics {
  total_rag_queries: number
  rag_usage_rate: number
  top_sources: RAGSource[]
  avg_similarity_score: number
  collections_stats: CollectionStats[]
}

export interface ErrorLog {
  chat_id: string
  mensagem_id: string
  agent_name: string
  error: string
  created_at: string
  execution_time_ms: number
}

export interface SlowQuery {
  chat_id: string
  mensagem_id: string
  agent_name: string
  execution_time_ms: number
  tokens: number
  rag_used: boolean
  created_at: string
}

export interface QualityMetrics {
  total_messages: number
  successful_messages: number
  failed_messages: number
  success_rate: number
  errors: ErrorLog[]
  slow_queries: SlowQuery[]
}

export interface TokensByDay {
  date: string  // "2025-01-15"
  total_tokens: number
  input_tokens: number
  output_tokens: number
}

export interface DashboardData {
  overview: OverviewMetrics
  token_consumption: TokenConsumption
  tokens_by_day: TokensByDay[]
  agents_performance: AgentPerformance[]
  conversation_insights: ConversationInsights
  rag_analytics: RAGAnalytics
  quality_metrics: QualityMetrics
  generated_at: string
}

export interface DashboardFilters {
  period: '7d' | '30d' | '90d' | '365d' | 'custom'
  start_date?: string
  end_date?: string
}
