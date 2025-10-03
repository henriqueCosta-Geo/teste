'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Loader2, ArrowLeft, Settings, Bot, User } from 'lucide-react'
import { teamsAPI } from '@/lib/api'
import CustomerMarkdownRenderer from '@/components/CustomerMarkdownRenderer'

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
  welcomeMessage: string
  quickReplies?: string[]
}

export default function CustomerChatPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.customerId as string

  const [team, setTeam] = useState<Team | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId] = useState(() => `customer-${customerId}-${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Configuração do customer (pode vir da API futuramente)
  const [customerConfig] = useState<CustomerConfig>({
    name: decodeURIComponent(customerId).toUpperCase(),
    primaryColor: '#1E40AF',
    welcomeMessage: 'Olá! Como posso ajudar você hoje?',
    quickReplies: ['CH570', 'CH670', 'CH950', 'A9000', 'A8000', 'A8810']
  })

  useEffect(() => {
    loadTeam()
    loadMessages()
  }, [customerId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Aplicar cor customizada
  useEffect(() => {
    document.documentElement.style.setProperty('--customer-primary', customerConfig.primaryColor)
  }, [customerConfig.primaryColor])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadTeam = async () => {
    try {
      // Buscar todos os times e pegar o primeiro (ou filtrar por customer no futuro)
      const teams = await teamsAPI.list()
      if (teams && teams.length > 0) {
        setTeam(teams[0])
        console.log('✅ Team carregado:', teams[0])
      }
    } catch (error) {
      console.error('❌ Erro ao carregar team:', error)
    }
  }

  const loadMessages = async () => {
    // Para sessões novas, começar sem histórico
    // O histórico será carregado automaticamente nas próximas mensagens via contexto do backend
    console.log('ℹ️ Sessão de chat iniciada:', sessionId)
  }

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim()
    if (!textToSend || !team) return

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

    try {
      const response = await teamsAPI.executeStream(team.id, {
        task: textToSend,
        session_id: sessionId,
        stream: true
      })

      let assistantMessage = ''
      let agentName = 'Assistente'

      for await (const chunk of response) {
        if (chunk.type === 'content') {
          assistantMessage += chunk.content
          // Atualizar mensagem em tempo real
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1]
            if (lastMsg?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...lastMsg, content: assistantMessage }]
            } else {
              return [...prev, {
                id: `assistant-${Date.now()}`,
                content: assistantMessage,
                role: 'assistant',
                timestamp: new Date().toISOString(),
                agent_name: agentName
              }]
            }
          })
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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: customerConfig.primaryColor }}
              >
                {customerConfig.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {customerConfig.name}
                </h1>
                <p className="text-sm text-gray-500">Suporte Técnico</p>
              </div>
            </div>
          </div>

          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${customerConfig.primaryColor}20` }}
              >
                <Bot className="w-10 h-10" style={{ color: customerConfig.primaryColor }} />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {customerConfig.welcomeMessage}
              </h2>
              <p className="text-gray-600 mb-6">
                Estou aqui para ajudar com suporte técnico especializado.
              </p>

              {/* Quick Replies */}
              {customerConfig.quickReplies && customerConfig.quickReplies.length > 0 && (
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-gray-500 mb-3">Selecione um modelo:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {customerConfig.quickReplies.map((reply) => (
                      <button
                        key={reply}
                        onClick={() => handleQuickReply(reply)}
                        className="px-4 py-2 rounded-full border-2 text-sm font-medium transition-all hover:scale-105"
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

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' ? 'bg-gray-300' : ''
                  }`}
                  style={message.role === 'assistant' ? {
                    backgroundColor: `${customerConfig.primaryColor}20`
                  } : {}}
                >
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-gray-700" />
                  ) : (
                    <Bot className="w-5 h-5" style={{ color: customerConfig.primaryColor }} />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-1">
                  {/* Agent Name Badge (for assistant) */}
                  {message.role === 'assistant' && message.agent_name && (
                    <div className="flex items-center gap-2 px-3">
                      <span className="text-xs font-medium text-gray-600">
                        {message.agent_name}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm ${
                      message.role === 'user'
                        ? 'text-white'
                        : 'bg-white text-gray-900'
                    }`}
                    style={message.role === 'user' ? {
                      backgroundColor: customerConfig.primaryColor
                    } : {}}
                  >
                    {message.role === 'assistant' ? (
                      <CustomerMarkdownRenderer content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className={`px-3 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
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

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[80%]">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${customerConfig.primaryColor}20` }}
                >
                  <Bot className="w-5 h-5" style={{ color: customerConfig.primaryColor }} />
                </div>
                <div className="bg-white rounded-2xl px-6 py-4 shadow-sm">
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
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                rows={1}
                disabled={loading}
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:border-transparent resize-none"
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-3 rounded-full text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
              style={{ backgroundColor: customerConfig.primaryColor }}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Send className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
