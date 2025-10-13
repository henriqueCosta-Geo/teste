'use client'

import React, { useState } from 'react'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { chatAPI } from '@/lib/api'
import CopyButton from './CopyButton'

interface MessageFeedbackProps {
  chatId: string
  messageId: string
  messageContent: string
  initialFeedback?: 'positive' | 'negative' | null
  onFeedbackSubmit?: (feedback: 'positive' | 'negative') => void
}

export default function MessageFeedback({
  chatId,
  messageId,
  messageContent,
  initialFeedback = null,
  onFeedbackSubmit
}: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(initialFeedback)
  const [loading, setLoading] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)

  const handleFeedback = async (type: 'positive' | 'negative') => {
    if (loading || feedback) return // Já enviou feedback

    setLoading(true)

    try {
      // Usar a API do lib/api.ts que segue o padrão do projeto
      await chatAPI.sendFeedback(chatId, messageId, {
        rating: type === 'positive' ? 5 : 1
      })

      setFeedback(type)
      setShowThankYou(true)

      // Chamar callback se existir
      onFeedbackSubmit?.(type)

      // Esconder mensagem de agradecimento após 3 segundos
      setTimeout(() => {
        setShowThankYou(false)
      }, 3000)

    } catch (error) {
      console.error('Erro ao enviar feedback:', error)
      alert('Erro ao enviar feedback. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      {showThankYou ? (
        <span className="text-xs text-green-600 font-medium">
          Obrigado pelo feedback!
        </span>
      ) : (
        <>
          <button
            onClick={() => handleFeedback('positive')}
            disabled={loading || feedback !== null}
            className={`p-1.5 rounded-full transition-all duration-200 ${
              feedback === 'positive'
                ? 'bg-green-100 text-green-600'
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
            } ${
              feedback && feedback !== 'positive' ? 'opacity-30' : ''
            } disabled:cursor-not-allowed`}
            title="Resposta útil"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => handleFeedback('negative')}
            disabled={loading || feedback !== null}
            className={`p-1.5 rounded-full transition-all duration-200 ${
              feedback === 'negative'
                ? 'bg-red-100 text-red-600'
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
            } ${
              feedback && feedback !== 'negative' ? 'opacity-30' : ''
            } disabled:cursor-not-allowed`}
            title="Resposta não útil"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
          </button>

          {/* Botão de copiar */}
          <CopyButton content={messageContent} size={14} />

          {!feedback && (
            <span className="text-xs text-gray-400 ml-1">
              Esta resposta foi útil?
            </span>
          )}
        </>
      )}
    </div>
  )
}
