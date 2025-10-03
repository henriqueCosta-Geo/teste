import React from 'react'

interface CustomerMarkdownRendererProps {
  content: string
  className?: string
}

// Componente de renderização de markdown customizado para clientes
export default function CustomerMarkdownRenderer({ content, className = '' }: CustomerMarkdownRendererProps) {
  // Função para processar markdown básico
  const processMarkdown = (text: string): string => {
    return text
      // Títulos (com quebras antes e depois)
      .replace(/^### (.*$)/gim, '\n<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900">$1</h3>\n')
      .replace(/^## (.*$)/gim, '\n<h2 class="text-xl font-semibold mt-4 mb-2 text-gray-900">$1</h2>\n')
      .replace(/^# (.*$)/gim, '\n<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900">$1</h1>\n')

      // Negrito e itálico
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')

      // Código inline
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>')

      // Listas não ordenadas (envolve em <ul>)
      .replace(/((?:^[\s]*[-*+•] .*$\n?)+)/gm, (match) => {
        const items = match.replace(/^[\s]*[-*+•] (.*)$/gm, '<li class="ml-4 mb-1">$1</li>')
        return `<ul class="list-none mb-4">${items}</ul>`
      })

      // Listas ordenadas (envolve em <ol>)
      .replace(/((?:^[\s]*\d+\. .*$\n?)+)/gm, (match) => {
        const items = match.replace(/^[\s]*\d+\. (.*)$/gm, '<li class="ml-4 mb-1">$1</li>')
        return `<ol class="list-decimal list-inside mb-4">${items}</ol>`
      })

      // Quebras de linha duplas para parágrafos
      .replace(/\n\n+/g, '</p><p class="mb-2">')

      // Quebras de linha simples (apenas fora de elementos HTML)
      .replace(/([^>])\n([^<])/g, '$1<br />$2')
  }

  // Processar blocos de código
  const processCodeBlocks = (text: string): string => {
    return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
      return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono">${code.trim()}</code></pre>`
    })
  }

  // Processar citações
  const processBlockquotes = (text: string): string => {
    return text.replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50 italic text-gray-700 my-2">$1</blockquote>')
  }

  const processedContent = React.useMemo(() => {
    let processed = content
    processed = processCodeBlocks(processed)
    processed = processBlockquotes(processed)
    processed = processMarkdown(processed)

    // Envolver em parágrafo se não começar com uma tag HTML
    if (!processed.startsWith('<')) {
      processed = `<p class="mb-2">${processed}</p>`
    }

    return processed
  }, [content])

  return (
    <div
      className={`prose prose-sm max-w-none text-gray-900 ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}
