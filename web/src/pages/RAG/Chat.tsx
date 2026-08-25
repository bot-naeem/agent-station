import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { SendHorizonal, Sparkles, Trash2, SlidersHorizontal, X } from 'lucide-react'
import { ragApi, type RAGSource, type RAGChatRequest } from '../../services/api'
import { ChatMessage } from '../../components/ChatMessage'
import { clsx } from 'clsx'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: RAGSource[]
}

const SUGGESTIONS = [
  { icon: '📋', title: '总结近期工作', prompt: '总结一下最近所有 Agent 的工作内容，按时间排列' },
  { icon: '🔍', title: '查找部署记录', prompt: '帮我找找关于部署、Docker 相关的日志记录' },
  { icon: '🐛', title: '回顾踩坑经历', prompt: '历史上有哪些踩过的坑？分别是怎么解决的？' },
  { icon: '🤖', title: '了解 Agent 接入', prompt: '有哪些 Agent 接入了平台？它们各自做了什么？' },
]

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<{ session_id?: string; agent_type?: string }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 输入框自动增高
  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const chatMutation = useMutation({
    mutationFn: (req: RAGChatRequest) => ragApi.chat(req),
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ])
      setIsLoading(false)
    },
    onError: (error) => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `抱歉，发生了错误：${(error as Error).message}` },
      ])
      setIsLoading(false)
    },
  })

  const send = (text: string) => {
    if (!text.trim() || isLoading) return
    setMessages(prev => [...prev, { role: 'user', content: text }])
    const chatRequest: RAGChatRequest = {
      messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }],
      session_id: filters.session_id,
      agent_type: filters.agent_type,
      top_k: 5,
      temperature: 0.7,
    }
    setIsLoading(true)
    chatMutation.mutate(chatRequest)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send(input)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleSuggestion = (prompt: string) => {
    if (isLoading || messages.length > 0) return
    send(prompt)
  }

  const activeFilterCount = (filters.session_id ? 1 : 0) + (filters.agent_type ? 1 : 0)

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
      {/* ─── 顶栏 ─── */}
      <div className="flex items-center justify-end gap-1.5 pb-3">

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              showFilters || activeFilterCount > 0
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            检索范围
            {activeFilterCount > 0 && (
              <span className={clsx(
                'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                showFilters ? 'bg-white/25 text-white' : 'bg-white text-primary-600',
              )}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-200 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空
          </button>
        </div>
      </div>

      {/* ─── 筛选面板 ─── */}
      {showFilters && (
        <div className="card mb-3 grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Agent 类型</label>
            <select
              value={filters.agent_type || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, agent_type: e.target.value || undefined }))}
              className="input"
            >
              <option value="">全部 Agent</option>
              <option value="opencode">opencode</option>
              <option value="claude">claude</option>
              <option value="codex">codex</option>
              <option value="gemini">gemini</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Session ID（可选）</label>
            <input
              type="text"
              placeholder="限定特定会话"
              value={filters.session_id || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, session_id: e.target.value || undefined }))}
              className="input font-mono text-xs"
            />
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({})} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-3.5 w-3.5" />清除
            </button>
          </div>
        </div>
      )}

      {/* ─── 消息区 ─── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full space-y-5 overflow-y-auto px-1 py-2 scrollbar-thin">
          {/* 欢迎屏 */}
          {messages.length === 0 && !isLoading && (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/30">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-gray-900">问问你的工作日志</h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-gray-500">
                我读过所有 Agent 写入的日志，可以直接回答关于历史工作的问题，并附上出处
              </p>

              <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.title}
                    onClick={() => handleSuggestion(s.prompt)}
                    className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md hover:shadow-primary-100"
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-800 group-hover:text-primary-700">{s.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">{s.prompt}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {messages.map((msg, index) => (
            <ChatMessage key={index} role={msg.role} content={msg.content} sources={msg.sources} />
          ))}

          {isLoading && (
            <ChatMessage role="assistant" content="" isStreaming />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── 输入区 ─── */}
      <form onSubmit={handleSubmit} className="pt-3">
        <div className="card flex items-end gap-2 p-2 transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary-300">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={isLoading ? '思考中…' : '输入你的问题…'}
            disabled={isLoading}
            rows={1}
            className="max-h-40 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="发送"
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
              input.trim() && !isLoading
                ? 'bg-gradient-to-br from-primary-500 to-blue-600 text-white shadow-md shadow-primary-500/30 hover:brightness-110 active:scale-95'
                : 'bg-gray-100 text-gray-300',
            )}
          >
            <SendHorizonal className="h-4.5 w-4.5" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-gray-300">
          Enter 发送 · Shift + Enter 换行 · 回答基于日志检索生成，请注意甄别
        </p>
      </form>
    </div>
  )
}
