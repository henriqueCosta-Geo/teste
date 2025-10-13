'use client'

import React, { useState, useEffect } from 'react'
import { X, Bot, CheckCircle } from 'lucide-react'

interface ChatWelcomeWatermarkProps {
  customerName: string
  storageKey: string
}

export default function ChatWelcomeWatermark({
  customerName,
  storageKey
}: ChatWelcomeWatermarkProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Verificar se o usuário já dispensou o watermark
    const dismissed = localStorage.getItem(storageKey)
    if (dismissed === 'true') {
      setIsVisible(false)
    }
  }, [storageKey])

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <div className="max-w-2xl mx-auto px-6 pointer-events-auto">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 relative">
          {/* Botão fechar */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Ícone e Título */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Bot className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Assistente Inteligente {customerName}
            </h3>
          </div>

          {/* Descrição */}
          <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
            Suporte especializado em manutenção automotiva de colhedoras com acesso
            aos manuais e informações técnicas das máquinas.
          </p>

          {/* Como usar */}
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="text-green-600 dark:text-green-400 mt-0.5">📌</div>
              <div>
                <strong className="text-gray-900 dark:text-white">Como usar:</strong>
              </div>
            </div>

            <div className="space-y-2 ml-6">
              <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  Faça perguntas sobre falhas, procedimentos e conhecimento nos sistemas
                  hidráulico, mecânico e elétrico das colhedoras.
                </span>
              </div>

              <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  Envie feedback e ajude a melhorar o assistente (👍 e 👎)
                </span>
              </div>
            </div>
          </div>

          {/* Hint para fechar */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Este card será fechado automaticamente ao iniciar uma conversa
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
