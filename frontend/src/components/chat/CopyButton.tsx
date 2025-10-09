'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  content: string
  className?: string
  size?: number
}

export default function CopyButton({ content, className = '', size = 16 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Erro ao copiar:', error)
      alert('Erro ao copiar texto')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-lg transition-all duration-200 hover:bg-gray-200 ${className}`}
      title="Copiar mensagem"
    >
      {copied ? (
        <Check size={size} className="text-green-600" />
      ) : (
        <Copy size={size} className="text-gray-500" />
      )}
    </button>
  )
}
