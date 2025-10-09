'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Send, Users, User, ArrowLeft, Loader, Crown, ArrowDown, Bot } from 'lucide-react'
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
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [team, setTeam] = useState<Team | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [teamError, setTeamError] = useState(false)
  const [sessionId] = useState(() => `team-${params.id}-${Date.now()}`)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Obter customerId da query string (quando admin acessa via dashboard)
  const customerIdFromQuery = searchParams.get('customerId')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isAutoScrolling = useRef(true)

  useEffect(() => {
    loadTeam()
    loadMessages()
  }, [params.id])

  // Auto-scroll INTELIGENTE
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150

      setShowScrollButton(!isNearBottom)
      isAutoScrolling.current = isNearBottom
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isAutoScrolling.current) {
      scrollToBottom('auto')
    }
  }, [messages, isStreaming, streamingMessage])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  const forceScrollToBottom = () => {
    isAutoScrolling.current = true
    scrollToBottom('smooth')
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

      if (isNaN(teamId)) {
        console.log('🔍 ID não numérico detectado, tentando buscar por nome:', params.id)

        try {
          const allTeams = await teamsAPI.list()
          const decodedName = decodeURIComponent(params.id as string)

          const foundTeam = allTeams.find((team: any) =>
            team.name === decodedName ||
            team.name.toLowerCase() === decodedName.toLowerCase()
          )

          if (foundTeam) {
            console.log(`✅ Team encontrado pelo nome, redirecionando para ID ${foundTeam.id}`)
            window.location.replace(`/teams/${foundTeam.id}/chat`)
            return
          }
        } catch (error) {
          console.error('Erro ao buscar teams por nome:', error)
        }

        console.error('❌ ID de team inválido (não numérico):', params.id)
        setTeamError(true)
        return
      }

      console.log('✅ Carregando team ID:', teamId)
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

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    const newHeight = Math.min(e.target.scrollHeight, 120)
    e.target.style.height = `${newHeight}px`
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
    isAutoScrolling.current = true

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      console.log('Enviando tarefa para time ID:', params.id, 'Sessão:', sessionId)

      const teamId = parseInt(params.id as string)
      if (isNaN(teamId)) {
        throw new Error('ID do time inválido')
      }

      let finalResponse = ''
      let agentName = 'Time'

      // Determinar customer_id: priorizar query string (admin), fallback para session (regular user)
      const customerId = customerIdFromQuery
        ? parseInt(customerIdFromQuery)
        : session?.user?.customer_id

      console.log('🔍 [CUSTOMER-ID] Query:', customerIdFromQuery, 'Session:', session?.user?.customer_id, 'Final:', customerId)

      const response = teamsAPI.executeStream(teamId, {
        task: userMessage.content.trim(),
        session_id: sessionId,
        stream: true,
        user_id: session?.user?.id ? parseInt(session.user.id) : undefined,
        customer_id: customerId
      })

      for await (const chunk of response) {
        if (chunk.type === 'start') {
          console.log('🚀 Streaming iniciado para time:', chunk.team_name)
        } else if (chunk.type === 'progress') {
          setStreamingMessage(chunk.message || '')
        } else if (chunk.type === 'content') {
          if (chunk.content) {
            finalResponse += chunk.content
            setStreamingMessage(finalResponse)
          }
          if (chunk.agent_name) {
            agentName = chunk.agent_name
          }

          // Auto-scroll durante streaming
          if (isAutoScrolling.current) {
            requestAnimationFrame(() => scrollToBottom('auto'))
          }
        } else if (chunk.type === 'completed') {
          console.log('✅ Streaming concluído')
          setIsStreaming(false)
          setStreamingMessage('')

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e as any)
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
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header FIXO */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={() => router.back()}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-green-100 flex-shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base md:text-xl font-semibold text-gray-900 truncate">
                  {team.name}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  {team.members.length} agentes especializados
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area - SCROLL INDEPENDENTE */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto relative"
      >
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 space-y-3 sm:space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
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
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex gap-2 sm:gap-3 w-full sm:w-[95%] md:w-[90%] lg:w-[85%] xl:w-[75%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' ? 'bg-gray-300' : 'bg-green-100'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                    ) : (
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    {message.role === 'assistant' && message.agent_name && (
                      <div className="flex items-center gap-2 px-2 sm:px-3">
                        <span className="text-xs font-medium text-gray-600">
                          {message.agent_name}
                        </span>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm ${
                        message.role === 'user'
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                      ) : (
                        <MarkdownRenderer content={message.content} />
                      )}
                    </div>

                    <div className={`px-2 sm:px-3 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <span className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Streaming Indicator */}
          {(loading || isStreaming) && (
            <div className="flex justify-start">
              <div className="flex gap-2 sm:gap-3 w-full sm:w-[95%] md:w-[90%] lg:w-[85%] xl:w-[75%]">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div className="bg-white text-gray-900 border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow-sm flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader size={16} className="animate-spin text-green-600" />
                    <span className="font-medium text-sm">
                      {isStreaming ? 'Respondendo...' : 'Processando...'}
                    </span>
                  </div>

                  {isStreaming && streamingMessage && (
                    <div className="mb-3 p-2 sm:p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
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
                          <span>Resposta em tempo real</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span>Distribuindo entre {team.members.length} agentes</span>
                        </div>
                        {team.leader && (
                          <div className="flex items-center gap-1">
                            <Crown size={10} className="text-yellow-500" />
                            <span>{team.leader.name} coordenando</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={forceScrollToBottom}
            className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 md:right-8 p-2 sm:p-3 bg-green-600 rounded-full shadow-lg hover:scale-110 transition-all z-10"
          >
            <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        )}
      </div>

      {/* Input Area - FIXO NO RODAPÉ */}
      <div className="bg-white border-t border-gray-200 shadow-lg flex-shrink-0">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-3 sm:py-4">
          <form onSubmit={sendMessage}>
            <div className="flex gap-2 sm:gap-3 items-end">
              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Digite sua pergunta para o time..."
                  rows={1}
                  disabled={loading}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm sm:text-base disabled:bg-gray-100"
                  style={{
                    maxHeight: '120px',
                    minHeight: '44px'
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || isStreaming || !input.trim()}
                className="p-2 sm:p-3 bg-green-600 text-white rounded-full transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex-shrink-0"
              >
                {loading || isStreaming ? (
                  <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                ) : (
                  <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
