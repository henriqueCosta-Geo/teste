'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Users, User, ArrowLeft, Loader, Crown } from 'lucide-react'
import { teamsAPI } from '@/lib/api'
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
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
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
    if (!input.trim() || loading || isStreaming) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input.trim(),
      role: 'user',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setIsStreaming(true)
    setStreamingMessage('')

    try {
      console.log('Enviando tarefa para time ID:', params.id, 'Sessão:', sessionId)
      console.log('Tarefa:', userMessage.content.substring(0, 50) + '...')

      const teamId = parseInt(params.id as string)
      if (isNaN(teamId)) {
        throw new Error('ID do time inválido')
      }

      let finalResponse = ''
      let agentName = 'Time'

      // Usar streaming
      const response = teamsAPI.executeStream(teamId, {
        task: userMessage.content.trim(),
        session_id: sessionId,
        stream: true
      })

      for await (const chunk of response) {
        console.log('Chunk recebido:', chunk)

        if (chunk.type === 'start') {
          console.log('🚀 Streaming iniciado para time:', chunk.team_name)
        } else if (chunk.type === 'progress') {
          setStreamingMessage(chunk.message || '')
        } else if (chunk.type === 'content') {
          // Chunk de conteúdo - ACUMULAR caracteres (não substituir!)
          if (chunk.content) {
            finalResponse += chunk.content  // ✅ ACUMULAR ao invés de substituir
            setStreamingMessage(finalResponse)
          }
          if (chunk.agent_name) {
            agentName = chunk.agent_name
          }
        } else if (chunk.type === 'completed') {
          console.log('✅ Streaming concluído')
          setIsStreaming(false)
          setStreamingMessage('')

          // Criar mensagem final
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            content: finalResponse || 'Resposta processada com sucesso.',
            role: 'assistant',
            timestamp: new Date().toISOString(),
            agent_name: agentName
          }

          setMessages(prev => [...prev, assistantMessage])
        } else if (chunk.type === 'error') {
          console.error('❌ Erro no streaming:', chunk)
          setIsStreaming(false)
          setStreamingMessage('')

          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            content: chunk.message || 'Erro durante o processamento.',
            role: 'assistant',
            timestamp: new Date().toISOString(),
            agent_name: 'Sistema'
          }

          setMessages(prev => [...prev, errorMessage])
        }
      }

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      setIsStreaming(false)
      setStreamingMessage('')

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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Inicie uma conversa
              </h3>
              <p className="text-gray-600">
                Digite sua mensagem abaixo para começar
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white ml-auto'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
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
              </div>
            ))
          )}
          
          {(loading || isStreaming) && (
            <div className="flex gap-3 justify-start">
              <div className="bg-white text-gray-900 border border-gray-200 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Loader size={16} className="animate-spin text-blue-600" />
                  <span className="font-medium">
                    {isStreaming ? 'Respondendo...' : 'Processando...'}
                  </span>
                </div>

                {isStreaming && streamingMessage && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                    <div className="text-sm text-gray-700">
                      <MarkdownRenderer content={streamingMessage} />
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600 space-y-1">
                  {isStreaming ? (
                    <>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span>Resposta sendo construída em tempo real</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span>Aguarde o processamento completo...</span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
              disabled={loading || isStreaming || !input.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
              {isStreaming ? 'Respondendo...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}