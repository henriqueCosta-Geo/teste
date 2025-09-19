'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Users, User, ArrowLeft, Loader, Crown } from 'lucide-react'
import { teamsAPI } from '../lib/api'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  agent_name?: string
}

interface TeamMember {
  agent_id: number
  role_in_team: string
  agent: {
    id: number
    name: string
    role: string
  }
}

interface Team {
  id: number
  name: string
  description?: string
  leader_agent_id?: number
  leader?: {
    id: number
    name: string
    role: string
  }
  members: TeamMember[]
}

export default function TeamChatPage() {
  const params = useParams()
  const router = useRouter()
  const [team, setTeam] = useState<Team | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [teamError, setTeamError] = useState(false)
  const [sessionId] = useState(() => `team-${params.id}-${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    loadTeam()
    loadMessages()
  }, [params.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadTeam = async () => {
    try {
      setLoadingTeam(true)
      setTeamError(false)

      if (!params.id) {
        console.error('❌ Nenhum ID de team fornecido')
        setTeamError(true)
        return
      }

      const teamId = parseInt(params.id as string)

      // Se o ID não é numérico, pode ser um nome de team - tentar redirecionar
      if (isNaN(teamId)) {
        console.log('🔍 ID não numérico detectado, tentando buscar por nome:', params.id)

        try {
          // Buscar todos os teams para encontrar pelo nome
          const allTeams = await teamsAPI.list()
          const decodedName = decodeURIComponent(params.id as string)

          const foundTeam = allTeams.find((team: any) =>
            team.name === decodedName ||
            team.name.toLowerCase() === decodedName.toLowerCase()
          )

          if (foundTeam) {
            console.log(`✅ Team encontrado pelo nome, redirecionando para ID ${foundTeam.id}`)
            // Redirecionar para a URL correta com ID
            window.location.replace(`/teams/${foundTeam.id}/chat`)
            return
          }
        } catch (error) {
          console.error('Erro ao buscar teams por nome:', error)
        }

        console.error('❌ ID de team inválido (não numérico):', params.id)
        console.error('- Se você chegou aqui através de um link, o link pode estar incorreto')
        console.error('- IDs de team devem ser números, não nomes')
        setTeamError(true)
        return
      }

      console.log('✅ Carregando team ID:', teamId)

      // Usar a API lib diretamente para evitar problemas de proxy
      const data = await teamsAPI.get(teamId)
      console.log('✅ Team carregado:', data)
      setTeam(data)

    } catch (error) {
      console.error('❌ Erro ao carregar time:', error)
      setTeamError(true)
    } finally {
      setLoadingTeam(false)
    }
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/proxy/api/agents/chat/history/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input.trim(),
      role: 'user',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      console.log('Enviando tarefa para time ID:', params.id, 'Sessão:', sessionId)
      console.log('Tarefa:', userMessage.content.substring(0, 50) + '...')
      
      const teamId = parseInt(params.id as string)
      if (isNaN(teamId)) {
        throw new Error('ID do time inválido')
      }

      // Usar a API lib diretamente para evitar problemas de proxy
      const data = await teamsAPI.execute(teamId, userMessage.content.trim(), sessionId)
      console.log('Resposta do time recebida:', data)
      
      // Verificar diferentes formatos de resposta para teams
      let responseContent = ''
      if (data.team_response) {
        responseContent = data.team_response
      } else if (data.response) {
        responseContent = data.response
      } else if (data.final_response) {
        responseContent = data.final_response
      } else if (typeof data === 'string') {
        responseContent = data
      } else {
        responseContent = 'Desculpe, não consegui processar sua solicitação.'
        console.warn('Resposta do time em formato inesperado:', data)
      }
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: responseContent,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        agent_name: data.coordinating_agent || data.agent_name || 'Time'
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        agent_name: 'Sistema'
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3 text-gray-600">Carregando time...</span>
      </div>
    )
  }

  if (teamError || !team) {
    const isInvalidId = isNaN(parseInt(params.id as string))

    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <Users size={64} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isInvalidId ? 'ID de time inválido' : 'Time não encontrado'}
        </h3>
        <p className="text-gray-600 mb-6">
          {isInvalidId
            ? `O ID "${params.id}" não é válido. IDs de team devem ser números.`
            : 'O time solicitado não existe ou não está disponível.'
          }
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/teams')}
            className="btn-primary"
          >
            <ArrowLeft size={16} />
            Ver todos os times
          </button>
          <button
            onClick={() => router.back()}
            className="btn-outline"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{team.name}</h1>
                <p className="text-sm text-gray-600">
                  {team.members.length} membros
                  {team.leader && (
                    <span className="ml-2">
                      • Líder: {team.leader.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">
              Sessão: {sessionId.substring(0, 16)}...
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Users size={12} />
              <span>Chat colaborativo</span>
            </div>
          </div>
        </div>

        {/* Team Members */}
        {team.members.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {team.members.map((member) => (
                <div
                  key={member.agent_id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-700"
                >
                  {team.leader_agent_id === member.agent_id && (
                    <Crown size={10} className="text-yellow-500" />
                  )}
                  <span>{member.agent.name}</span>
                  <span className="text-gray-500">({member.agent.role})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Inicie uma conversa colaborativa
              </h3>
              <p className="text-gray-600">
                Faça uma pergunta ou solicite uma tarefa para o time {team.name}
              </p>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 <strong>Dica:</strong> O time trabalhará em conjunto para responder sua pergunta.
                  {team.leader && ` O líder ${team.leader.name} coordenará a resposta.`}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Users size={16} className="text-green-600" />
                  </div>
                )}
                
                <div
                  className={`max-w-2xl px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {message.role === 'assistant' && message.agent_name && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        👤 {message.agent_name}
                      </div>
                      {message.agent_name !== 'Time' && team.leader?.name === message.agent_name && (
                        <div title="Líder do time">
                          <Crown size={12} className="text-yellow-500" />
                        </div>
                      )}
                    </div>
                  )}
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <MarkdownRenderer content={message.content} />
                  )}
                  <div
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <User size={16} className="text-gray-600" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Users size={16} className="text-green-600" />
              </div>
              <div className="bg-white text-gray-900 border border-gray-200 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Loader size={16} className="animate-spin text-green-600" />
                  <span className="font-medium">O time está colaborando...</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Analisando tarefa e distribuindo entre membros</span>
                  </div>
                  {team.leader && (
                    <div className="flex items-center gap-1">
                      <Crown size={10} className="text-yellow-500" />
                      <span>{team.leader.name} coordenando a equipe</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span>Processando com {team.members.length} agentes especializados</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua pergunta para o time..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}