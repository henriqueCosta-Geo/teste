import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className={`prose prose-sm max-w-none ${className}`}
      remarkPlugins={[remarkGfm]}
      components={{
        // Syntax highlighting para blocos de código
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800" {...props}>
              {children}
            </code>
          )
        },
        // Estilização customizada de tabelas
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300">
                {children}
              </table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="bg-gray-100">{children}</thead>
        },
        th({ children }) {
          return (
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
              {children}
            </th>
          )
        },
        td({ children }) {
          return (
            <td className="border border-gray-300 px-4 py-2">
              {children}
            </td>
          )
        },
        // Estilização de listas
        ul({ children }) {
          return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
        },
        // Estilização de parágrafos
        p({ children }) {
          return <p className="mb-2">{children}</p>
        },
        // Estilização de títulos
        h1({ children }) {
          return <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-xl font-semibold mt-4 mb-2">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
        },
        // Estilização de links
        a({ children, href }) {
          return (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
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
            <blockquote className="border-l-4 border-gray-300 pl-4 py-2 bg-gray-50 italic text-gray-700 my-2">
              {children}
            </blockquote>
          )
        },
        // Estilização de strong e em
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>
        },
        em({ children }) {
          return <em className="italic">{children}</em>
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
