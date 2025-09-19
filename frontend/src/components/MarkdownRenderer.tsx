import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

// Componente simples de renderização de markdown sem dependências externas
export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Função para processar markdown básico
  const processMarkdown = (text: string): string => {
    return text
      // Títulos
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      
      // Negrito e itálico
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      
      // Código inline
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>')
      
      // Listas não ordenadas
      .replace(/^[\s]*[-*+] (.*)$/gm, '<li class="ml-4 mb-1">• $1</li>')
      
      // Listas ordenadas
      .replace(/^[\s]*\d+\. (.*)$/gm, '<li class="ml-4 mb-1 list-decimal list-inside">$1</li>')
      
      // Quebras de linha duplas para parágrafos
      .replace(/\n\n/g, '</p><p class="mb-2">')
      
      // Quebras de linha simples
      .replace(/\n/g, '<br />')
  }

  // Processar blocos de código
  const processCodeBlocks = (text: string): string => {
    return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
      return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono">${code.trim()}</code></pre>`
    })
  }

  // Processar citações
  const processBlockquotes = (text: string): string => {
    return text.replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 py-2 bg-gray-50 italic text-gray-700 my-2">$1</blockquote>')
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
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}