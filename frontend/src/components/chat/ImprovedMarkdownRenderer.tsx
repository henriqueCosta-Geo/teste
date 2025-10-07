'use client'

import React from 'react'
import { Check, Copy } from 'lucide-react'

interface ImprovedMarkdownRendererProps {
  content: string
  className?: string
}

export default function ImprovedMarkdownRenderer({ content, className = '' }: ImprovedMarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const processMarkdown = (text: string): string => {
    let processed = text

    // Processar code blocks PRIMEIRO (antes de inline code)
    const codeBlocks: { id: string; code: string; language: string }[] = []
    processed = processed.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
      const id = `code-${Math.random().toString(36).substr(2, 9)}`
      codeBlocks.push({ id, code: code.trim(), language: language || 'text' })
      return `___CODE_BLOCK_${id}___`
    })

    // Processar blockquotes
    processed = processed.replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-blue-50/50 italic text-gray-700">$1</blockquote>')

    // Títulos
    processed = processed
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-6 mb-3 text-gray-900">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-900">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 text-gray-900">$1</h1>')

    // Listas não ordenadas
    processed = processed.replace(/((?:^[\s]*[-*+•] .*$\n?)+)/gm, (match) => {
      const items = match.replace(/^[\s]*[-*+•] (.*)$/gm, '<li class="mb-1.5 flex items-start gap-2"><span class="text-blue-600 mt-1">•</span><span class="flex-1">$1</span></li>')
      return `<ul class="my-3 space-y-1">${items}</ul>`
    })

    // Listas ordenadas
    processed = processed.replace(/((?:^[\s]*\d+\. .*$\n?)+)/gm, (match) => {
      const items = match.replace(/^[\s]*(\d+)\. (.*)$/gm, '<li class="mb-1.5 flex items-start gap-2"><span class="font-semibold text-blue-600 min-w-[24px]">$1.</span><span class="flex-1">$2</span></li>')
      return `<ol class="my-3 space-y-1">${items}</ol>`
    })

    // Tabelas simples
    processed = processed.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match) => {
      const lines = match.trim().split('\n')
      const headers = lines[0].split('|').filter(Boolean).map(h => h.trim())
      const rows = lines.slice(2).map(line => line.split('|').filter(Boolean).map(cell => cell.trim()))

      const headerRow = `<tr class="bg-gray-50">${headers.map(h => `<th class="px-4 py-2 text-left font-semibold text-gray-900 border-b-2 border-gray-300">${h}</th>`).join('')}</tr>`
      const bodyRows = rows.map(row => `<tr class="border-b border-gray-200 hover:bg-gray-50">${row.map(cell => `<td class="px-4 py-2 text-gray-800">${cell}</td>`).join('')}</tr>`).join('')

      return `<table class="w-full my-4 border border-gray-200 rounded-lg overflow-hidden">${headerRow}${bodyRows}</table>`
    })

    // Negrito e itálico
    processed = processed
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold italic text-gray-900">$1</strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>')
      .replace(/\_\_\_(.*?)\_\_\_/g, '<strong class="font-bold italic text-gray-900">$1</strong>')
      .replace(/\_\_(.*?)\_\_/g, '<strong class="font-bold text-gray-900">$1</strong>')
      .replace(/\_(.*?)\_/g, '<em class="italic text-gray-800">$1</em>')

    // Links
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline font-medium" target="_blank" rel="noopener noreferrer">$1</a>')

    // Código inline (DEPOIS de code blocks)
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-red-600 border border-gray-200">$1</code>')

    // Horizontal rules
    processed = processed.replace(/^---$/gm, '<hr class="my-6 border-t-2 border-gray-200" />')

    // Parágrafos (evitar duplicar em listas/headers)
    processed = processed.replace(/^(?!<[hou]|<blockquote|<table|<hr|___CODE)(.*?)$/gm, (match) => {
      if (match.trim() === '') return '<br />'
      if (match.startsWith('<')) return match
      return `<p class="mb-3 leading-relaxed text-gray-800">${match}</p>`
    })

    // Substituir code blocks de volta
    codeBlocks.forEach(({ id, code, language }) => {
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      const languageLabel = language ? `<span class="text-xs text-gray-400 absolute top-2 right-12 font-mono">${language}</span>` : ''

      processed = processed.replace(
        `___CODE_BLOCK_${id}___`,
        `<div class="relative my-4 group">
          ${languageLabel}
          <button
            onclick="navigator.clipboard.writeText(${JSON.stringify(code)}).then(() => { this.innerHTML = '<svg class=\\"w-4 h-4\\" fill=\\"currentColor\\" viewBox=\\"0 0 20 20\\"><path d=\\"M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z\\"/></svg>'; setTimeout(() => this.innerHTML = '<svg class=\\"w-4 h-4\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z\\"/></svg>', 2000) })"
            class="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copiar código"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </button>
          <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm"><code class="font-mono">${escapedCode}</code></pre>
        </div>`
      )
    })

    return processed
  }

  const processedContent = React.useMemo(() => {
    return processMarkdown(content)
  }, [content])

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}
