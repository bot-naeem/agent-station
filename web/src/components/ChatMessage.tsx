import { clsx } from 'clsx'
import { Copy, Check, Quote, ChevronDown, FileText, CalendarDays } from 'lucide-react'
import { useState } from 'react'
import type { RAGSource } from '../services/api'

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: RAGSource[]
  isStreaming?: boolean
}

export function ChatMessage({ role, content, sources, isStreaming }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const isUser = role === 'user'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={clsx('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* 头像 */}
      <div
        className={clsx(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-gray-600 to-gray-800 text-white'
            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white',
        )}
      >
        {isUser ? '你' : <Bot_Icon />}
      </div>

      <div className={clsx('flex min-w-0 max-w-[85%] flex-col', isUser ? 'items-end' : 'items-start')}>
        {/* 气泡 */}
        <div
          className={clsx(
            'relative px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser
              ? 'rounded-2xl rounded-tr-md bg-primary-600 text-white shadow-sm shadow-primary-500/20'
              : 'rounded-2xl rounded-tl-md border border-gray-200/80 bg-white text-gray-800 shadow-sm',
          )}
        >
          {content}
          {isStreaming && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
            </span>
          )}
        </div>

        {/* 消息工具条 */}
        {!isStreaming && (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        )}

        {/* 引用来源 */}
        {sources && sources.length > 0 && !isStreaming && (
          <div className="mt-1.5 w-full">
            <button
              onClick={() => setShowSources(!showSources)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all',
                showSources
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              <Quote className="h-3 w-3" />
              引用来源 {sources.length} 篇
              <ChevronDown className={clsx('h-3 w-3 transition-transform', showSources && 'rotate-180')} />
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50/60 transition-colors hover:border-gray-200"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 px-3 py-2">
                      <span className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded bg-primary-100 px-1 text-[10px] font-bold text-primary-700">
                        {index + 1}
                      </span>
                      <span className="font-mono text-[11px] text-gray-400">{source.agent_type}</span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
                        <CalendarDays className="h-3 w-3" />
                        {source.log_date}
                      </span>
                      <span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-600">
                        {(source.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    {source.title && (
                      <div className="flex items-center gap-1 px-3 pt-1.5 text-xs font-medium text-gray-700">
                        <FileText className="h-3 w-3 shrink-0 text-gray-300" />
                        <span className="truncate">{source.title}</span>
                      </div>
                    )}
                    <p className="max-h-24 overflow-hidden px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-500">
                      {source.chunk_content.length > 300
                        ? source.chunk_content.slice(0, 300) + '…'
                        : source.chunk_content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Bot_Icon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4.5 w-4.5" aria-hidden>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4M8 4h8" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
