'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Send, Loader2, ArrowLeft, Settings, Bot, User, ArrowDown, Maximize2, Minimize2, MessageSquarePlus } from 'lucide-react'
import { teamsAPI } from '@/lib/api'
import ImprovedMarkdownRenderer from '@/components/chat/ImprovedMarkdownRenderer'
import MessageFeedback from '@/components/chat/MessageFeedback'
import CopyButton from '@/components/chat/CopyButton'
import ChatDisclaimer from '@/components/chat/ChatDisclaimer'
import NewChatConfirmModal from '@/components/chat/NewChatConfirmModal'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  agent_name?: string
}

interface Team {
  id: number
  name: string
  description?: string
}

interface CustomerConfig {
  name: string
  logo?: string
  primaryColor: string
  secondaryColor?: string
  welcomeMessage: string
  quickReplies?: string[]
}

export default function CustomerChatPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const customerId = params.customerId as string

  const [team, setTeam] = useState<Team | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId] = useState(() => `customer-${customerId}-${Date.now()}`)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isAutoScrolling = useRef(true)

  // Configuração do customer - CARREGADA DA API
  const [customerConfig, setCustomerConfig] = useState<CustomerConfig>({
    name: decodeURIComponent(customerId).toUpperCase(),
    primaryColor: '#1E40AF',
    secondaryColor: '#3B82F6',
    welcomeMessage: 'Olá! Como posso ajudar você hoje?',
    quickReplies: ['CH570', 'CH670', 'CH950', 'A9000', 'A8000', 'A8810']
  })
  const [loadingConfig, setLoadingConfig] = useState(true)

  useEffect(() => {
    loadTeam()
    loadMessages()
    loadCustomerConfig()
  }, [customerId])

  // Auto-scroll INTELIGENTE - detecta se usuário rolou manualmente
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

  // Auto-scroll durante mensagens e streaming
  useEffect(() => {
    if (isAutoScrolling.current) {
      scrollToBottom('auto')
    }
  }, [messages, isTyping])

  // Aplicar cor customizada
  useEffect(() => {
    document.documentElement.style.setProperty('--customer-primary', customerConfig.primaryColor)
    document.documentElement.style.setProperty('--customer-secondary', customerConfig.secondaryColor || customerConfig.primaryColor)
  }, [customerConfig])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  const forceScrollToBottom = () => {
    isAutoScrolling.current = true
    scrollToBottom('smooth')
  }

  const loadTeam = async () => {
    try {
      const teams = await teamsAPI.list()
      if (teams && teams.length > 0) {
        setTeam(teams[0])
      }
    } catch (error) {
      console.error('❌ Erro ao carregar team:', error)
    }
  }

  const loadMessages = async () => {
    console.log('ℹ️ Sessão de chat iniciada:', sessionId)
  }

  const loadCustomerConfig = async () => {
    try {
      setLoadingConfig(true)
      const response = await fetch(`/api/customers/${customerId}/metadata`)

      if (response.ok) {
        const data = await response.json()

        // Extrair configurações de UI e chat
        const ui = data.ui || {}
        const chat = data.chat || {}

        setCustomerConfig({
          name: data.customer?.name || decodeURIComponent(customerId).toUpperCase(),
          logo: ui.logo_path,
          primaryColor: ui.primary_color || '#1E40AF',
          secondaryColor: ui.secondary_color || '#3B82F6',
          welcomeMessage: chat.welcome_message || 'Olá! Como posso ajudar você hoje?',
          quickReplies: chat.quick_replies || ['CH570', 'CH670', 'CH950', 'A9000', 'A8000', 'A8810']
        })
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configuração do customer:', error)
      // Manter configuração padrão em caso de erro
    } finally {
      setLoadingConfig(false)
    }
  }

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Reset height para calcular novo tamanho
    e.target.style.height = 'auto'

    // Limitar a 5 linhas (aproximadamente 120px)
    const newHeight = Math.min(e.target.scrollHeight, 120)
    e.target.style.height = `${newHeight}px`
  }

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim()
    if (!textToSend || !team || loading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: textToSend,
      role: 'user',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setIsTyping(true)
    isAutoScrolling.current = true

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const response = await teamsAPI.executeStream(team.id, {
        task: textToSend,
        session_id: sessionId,
        stream: true,
        customer_id: session?.user?.customer_id,
        user_id: session?.user?.id ? parseInt(session.user.id) : undefined
      })

      let assistantMessage = ''
      let agentName = 'Assistente'
      let messageId = `assistant-${Date.now()}`

      for await (const chunk of response) {
        if (chunk.type === 'content') {
          assistantMessage += chunk.content

          // Atualizar mensagem em tempo real
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1]
            if (lastMsg?.id === messageId) {
              return [...prev.slice(0, -1), { ...lastMsg, content: assistantMessage }]
            } else {
              return [...prev, {
                id: messageId,
                content: assistantMessage,
                role: 'assistant' as const,
                timestamp: new Date().toISOString(),
                agent_name: agentName
              }]
            }
          })

          // SCROLL A CADA CHUNK (FIX CRÍTICO)
          if (isAutoScrolling.current) {
            requestAnimationFrame(() => scrollToBottom('auto'))
          }
        } else if (chunk.type === 'agent' && chunk.agent_name) {
          agentName = chunk.agent_name
        }
      }

      setIsTyping(false)
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error)
      setIsTyping(false)

      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
        role: 'assistant',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickReply = (reply: string) => {
    handleSend(reply)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleNewChat = () => {
    // Limpar mensagens e gerar novo sessionId
    setMessages([])
    setInput('')
    // Recarregar a página para gerar novo sessionId
    window.location.reload()
  }

  return (
    <div className={`flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* Header - RESPONSIVO */}
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
              {customerConfig.logo ? (
                <img
                  src={customerConfig.logo}
                  alt={customerConfig.name}
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg flex-shrink-0"
                  style={{ backgroundColor: customerConfig.primaryColor }}
                >
                  {customerConfig.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base md:text-xl font-semibold text-gray-900 truncate">
                  {customerConfig.name}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate">Suporte Técnico</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Nova conversa"
            >
              <MessageSquarePlus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
              title={isFullscreen ? "Sair tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              ) : (
                <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              )}
            </button>
            <button className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area - LAYOUT FLUIDO 100% */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto relative"
      >
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 space-y-3 sm:space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${customerConfig.primaryColor}20` }}
              >
                <Bot className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: customerConfig.primaryColor }} />
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
                {customerConfig.welcomeMessage}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Estou aqui para ajudar com suporte técnico especializado.
              </p>

              {/* Quick Replies - RESPONSIVO */}
              {customerConfig.quickReplies && customerConfig.quickReplies.length > 0 && (
                <div className="max-w-2xl mx-auto">
                  <p className="text-xs sm:text-sm text-gray-500 mb-3">Selecione um modelo:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {customerConfig.quickReplies.map((reply) => (
                      <button
                        key={reply}
                        onClick={() => handleQuickReply(reply)}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border-2 text-xs sm:text-sm font-medium transition-all hover:scale-105"
                        style={{
                          borderColor: customerConfig.primaryColor,
                          color: customerConfig.primaryColor
                        }}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages - LARGURA RESPONSIVA */}
          {messages.map((message) => (
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
                    message.role === 'user' ? 'bg-gray-300' : ''
                  }`}
                  style={message.role === 'assistant' ? {
                    backgroundColor: `${customerConfig.primaryColor}20`
                  } : {}}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                  ) : (
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: customerConfig.primaryColor }} />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  {/* Agent Name Badge */}
                  {message.role === 'assistant' && message.agent_name && (
                    <div className="flex items-center gap-2 px-2 sm:px-3">
                      <span className="text-xs font-medium text-gray-600">
                        {message.agent_name}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  <div
                    className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm relative group ${
                      message.role === 'user'
                        ? 'text-white'
                        : 'bg-white text-gray-900'
                    }`}
                    style={message.role === 'user' ? {
                      backgroundColor: customerConfig.primaryColor
                    } : {}}
                  >
                    {message.role === 'assistant' && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton content={message.content} />
                      </div>
                    )}

                    {message.role === 'assistant' ? (
                      <ImprovedMarkdownRenderer content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</p>
                    )}
                  </div>

                  {/* Feedback Buttons - Apenas para mensagens do assistente */}
                  {message.role === 'assistant' && (
                    <div className="px-2 sm:px-3">
                      <MessageFeedback
                        chatId={sessionId}
                        messageId={message.id}
                      />
                    </div>
                  )}

                  {/* Timestamp */}
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
          ))}

          {/* Typing Indicator - MAIS SUTIL */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2 sm:gap-3 w-full sm:w-[95%] md:w-[90%] lg:w-[85%] xl:w-[75%]">
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${customerConfig.primaryColor}20` }}
                >
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: customerConfig.primaryColor }} />
                </div>
                <div className="bg-white rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
            className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 md:right-8 p-2 sm:p-3 rounded-full shadow-lg hover:scale-110 transition-all z-10"
            style={{ backgroundColor: customerConfig.primaryColor }}
          >
            <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        )}
      </div>

      {/* Input Area - TEXTAREA AUTO-EXPANSÍVEL */}
      <div className="bg-white border-t border-gray-200 shadow-lg flex-shrink-0">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-3 sm:py-4 space-y-3">
          {/* Disclaimer */}
          <ChatDisclaimer storageKey={`chat-disclaimer-${customerId}`} />

          <div className="flex gap-2 sm:gap-3 items-end">
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder="Digite sua mensagem..."
                rows={1}
                disabled={loading}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:border-transparent resize-none text-sm sm:text-base"
                style={{
                  maxHeight: '120px',
                  minHeight: '44px'
                }}
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2 sm:p-3 rounded-full text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex-shrink-0"
              style={{ backgroundColor: customerConfig.primaryColor }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <Send className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Nova Conversa */}
      <NewChatConfirmModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onConfirm={handleNewChat}
      />
    </div>
  )
}
