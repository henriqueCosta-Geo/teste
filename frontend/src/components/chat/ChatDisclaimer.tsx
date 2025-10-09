'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'

interface ChatDisclaimerProps {
  storageKey?: string
  className?: string
}

export default function ChatDisclaimer({
  storageKey = 'chat-disclaimer-dismissed',
  className = ''
}: ChatDisclaimerProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Verificar se o usuário já dispensou o disclaimer
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
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
            <strong>Atenção:</strong> A IA pode cometer erros. Sempre valide as informações
            e a <strong>decisão final é do técnico responsável</strong>.
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-amber-100 rounded transition-colors flex-shrink-0"
          title="Não mostrar novamente"
        >
          <X className="w-4 h-4 text-amber-600" />
        </button>
      </div>
    </div>
  )
}
