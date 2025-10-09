'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
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

  return (
    <ReactMarkdown
      className={`prose prose-sm max-w-none ${className}`}
      remarkPlugins={[remarkGfm]}
      components={{
        // Syntax highlighting para blocos de código COM botão de copiar
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          const codeString = String(children).replace(/\n$/, '')
          const codeId = `code-${Math.random().toString(36).substr(2, 9)}`

          return !inline && match ? (
            <div className="relative my-4 group">
              {/* Language Label */}
              <span className="text-xs text-gray-400 absolute top-2 right-12 font-mono z-10">
                {match[1]}
              </span>

              {/* Copy Button */}
              <button
                onClick={() => copyToClipboard(codeString, codeId)}
                className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Copiar código"
              >
                {copiedCode === codeId ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {/* Code Block */}
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ marginTop: 0, marginBottom: 0 }}
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-red-600 border border-gray-200" {...props}>
              {children}
            </code>
          )
        },

        // Estilização customizada de tabelas
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="bg-gray-50">{children}</thead>
        },
        th({ children }) {
          return (
            <th className="px-4 py-2 text-left font-semibold text-gray-900 border-b-2 border-gray-300">
              {children}
            </th>
          )
        },
        tr({ children }) {
          return <tr className="border-b border-gray-200 hover:bg-gray-50">{children}</tr>
        },
        td({ children }) {
          return (
            <td className="px-4 py-2 text-gray-800">
              {children}
            </td>
          )
        },

        // Estilização de listas
        ul({ children }) {
          return <ul className="my-3 space-y-1.5 list-none">{children}</ul>
        },
        ol({ children }) {
          return <ol className="my-3 space-y-1.5 list-none">{children}</ol>
        },
        li({ children, ordered }: any) {
          return (
            <li className="flex items-start gap-2">
              <span className={ordered ? "font-semibold text-blue-600 min-w-[24px]" : "text-blue-600 mt-1"}>
                {ordered ? '' : '•'}
              </span>
              <span className="flex-1">{children}</span>
            </li>
          )
        },

        // Estilização de parágrafos
        p({ children }) {
          return <p className="mb-3 leading-relaxed text-gray-800">{children}</p>
        },

        // Estilização de títulos
        h1({ children }) {
          return <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-xl font-bold mt-6 mb-3 text-gray-900">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-lg font-bold mt-6 mb-3 text-gray-900">{children}</h3>
        },

        // Estilização de links
        a({ children, href }) {
          return (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          )
        },

        // Estilização de blockquotes
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-blue-50/50 italic text-gray-700">
              {children}
            </blockquote>
          )
        },

        // Estilização de strong e em
        strong({ children }) {
          return <strong className="font-bold text-gray-900">{children}</strong>
        },
        em({ children }) {
          return <em className="italic text-gray-800">{children}</em>
        },

        // Horizontal rules
        hr() {
          return <hr className="my-6 border-t-2 border-gray-200" />
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
