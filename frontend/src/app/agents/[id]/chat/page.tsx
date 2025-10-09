'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Bot, User, ArrowLeft, Loader, MessageSquarePlus } from 'lucide-react'
import { agentsAPI } from '@/lib/api'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import MessageFeedback from '@/components/chat/MessageFeedback'
import CopyButton from '@/components/chat/CopyButton'
import ChatDisclaimer from '@/components/chat/ChatDisclaimer'
import NewChatConfirmModal from '@/components/chat/NewChatConfirmModal'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
}

interface Agent {
  id: number
  name: string
  description?: string
  role?: string
  model: string
  temperature: number
}

export default function AgentChatPage() {
  const params = useParams()
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [agentError, setAgentError] = useState(false)
  const [sessionId] = useState(() => `agent-${params.id}-${Date.now()}`)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAgent()
    loadMessages()
  }, [params.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadAgent = async () => {
    try {
      setLoadingAgent(true)
      setAgentError(false)
      const data = await agentsAPI.get(parseInt(params.id as string))
      setAgent(data)
    } catch (error) {
      console.error('Erro ao carregar agente:', error)
      setAgentError(true)
    } finally {
      setLoadingAgent(false)
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
      console.log('Enviando mensagem para agente ID:', params.id, 'Sessão:', sessionId)
      const data = await agentsAPI.chat(parseInt(params.id as string), userMessage.content, sessionId)
      console.log('Resposta recebida:', data)
      
      // Verificar diferentes formatos de resposta
      let responseContent = ''
      const responseData = data as any // Permitir acesso a qualquer propriedade
      
      if (responseData.response) {
        responseContent = responseData.response
      } else if (responseData.team_response) {
        responseContent = responseData.team_response
      } else if (typeof responseData === 'string') {
        responseContent = responseData
      } else {
        responseContent = 'Desculpe, não consegui processar sua solicitação.'
        console.warn('Resposta do agente em formato inesperado:', data)
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: responseContent,
        role: 'assistant',
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error)
      console.error('Detalhes do erro:', error)
      
      let errorContent = 'Desculpe, ocorreu um erro ao processar sua mensagem.'
      
      if (error.message?.includes('404')) {
        errorContent = 'Agente não encontrado. Por favor, verifique se o agente existe e está ativo.'
      } else if (error.message?.includes('400')) {
        errorContent = 'Agente está desativado ou há um problema com os dados enviados.'
      } else if (error.message?.includes('500')) {
        errorContent = 'Erro interno do servidor. Por favor, tente novamente em alguns instantes.'
      } else if (error.message) {
        errorContent = `Erro: ${error.message}`
      }
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: errorContent,
        role: 'assistant',
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = () => {
    // Limpar mensagens e recarregar para gerar novo sessionId
    setMessages([])
    setInput('')
    window.location.reload()
  }

  if (loadingAgent) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading"></div>
        <span className="ml-3 text-gray-600">Carregando agente...</span>
      </div>
    )
  }

  if (agentError || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <Bot size={64} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Agente não encontrado
        </h3>
        <p className="text-gray-600 mb-6">
          O agente solicitado não existe ou não está disponível.
        </p>
        <button
          onClick={() => router.push('/agents')}
          className="btn-primary"
        >
          <ArrowLeft size={16} />
          Voltar aos agentes
        </button>
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
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{agent.name}</h1>
                <p className="text-sm text-gray-600">
                  {agent.role} • {agent.model} • Temp: {agent.temperature}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Nova conversa"
            >
              <MessageSquarePlus size={20} />
            </button>
            <div className="text-sm text-gray-500">
              Sessão: {sessionId.substring(0, 16)}...
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Inicie uma conversa
              </h3>
              <p className="text-gray-600">
                Faça uma pergunta ou solicite uma tarefa para o agente {agent.name}
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
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={16} className="text-blue-600" />
                  </div>
                )}

                <div className="flex flex-col gap-2 max-w-2xl">
                  <div
                    className={`px-4 py-2 rounded-lg relative group ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton content={message.content} />
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

                  {/* Feedback Buttons - Apenas para mensagens do assistente */}
                  {message.role === 'assistant' && (
                    <MessageFeedback
                      chatId={sessionId}
                      messageId={message.id}
                    />
                  )}
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
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={16} className="text-blue-600" />
              </div>
              <div className="bg-white text-gray-900 border border-gray-200 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader size={16} className="animate-spin" />
                  <span>Processando...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto space-y-3">
          {/* Disclaimer */}
          <ChatDisclaimer storageKey={`chat-disclaimer-agent-${params.id}`} />

          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
              Enviar
            </button>
          </div>
        </form>
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