import { clsx } from 'clsx'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { RAGSource } from '../services/api'

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: RAGSource[]
  isStreaming?: boolean
}

export function ChatMessage({ role, content, sources, isStreaming }: ChatMessageProps) {
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const align = role === 'user' ? 'flex-row-reverse' : 'flex-row'
  const bgColor = role === 'user' ? 'bg-primary-600 text-white' : 'bg-white text-gray-900'

  return (
    <div className={clsx('flex gap-3 mb-4', align)}>
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
          role === 'user' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'
        )}
        aria-hidden="true"
      >
        {role === 'user' ? 'U' : 'AI'}
      </div>
      <div className={clsx('flex flex-col max-w-[80%]', align === 'flex-row-reverse' ? 'items-end' : 'items-start')}>
        <div
          className={clsx(
            'relative px-4 py-2 rounded-2xl text-sm leading-relaxed',
            role === 'user' ? 'rounded-br-none' : 'rounded-bl-none',
            bgColor
          )}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 whitespace-pre-wrap">{content}</div>
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
              aria-label="Copy message"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setShowSources(!showSources)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>引用来源 ({sources.length})</span>
              <svg className={clsx('h-4 w-4 transition-transform', showSources && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showSources && (
              <div className="mt-2 space-y-2">
                {sources.map((source, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3 text-xs border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <span className="font-medium">[来源 {index + 1}]</span>
                      <span>{source.log_date}</span>
                      <span className="badge badge-gray">{source.agent_type}</span>
                      {source.title && <span className="text-gray-700">{source.title}</span>}
                    </div>
                    <div className="text-gray-700 font-mono text-[11px] bg-white p-2 rounded border">
                      {source.chunk_content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
            <span className="animate-pulse">▌</span>
            <span>生成中...</span>
          </div>
        )}
      </div>
    </div>
  )
}