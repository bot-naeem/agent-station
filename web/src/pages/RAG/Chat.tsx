import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Bot, Filter, X } from 'lucide-react'
import { ragApi, type RAGSource, type RAGChatRequest } from '../../services/api'
import { ChatMessage } from '../../components/ChatMessage'
import { clsx } from 'clsx'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: RAGSource[]
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<{ session_id?: string; agent_type?: string }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])

    const chatRequest: RAGChatRequest = {
      messages: [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: input },
      ],
      session_id: filters.session_id,
      agent_type: filters.agent_type,
      top_k: 5,
      temperature: 0.7,
    }

    setInput('')
    setIsLoading(true)
    chatMutation.mutate(chatRequest)
  }

  const handleClear = () => {
    setMessages([])
  }

  const handleSuggestion = (suggestion: string) => {
    if (isLoading) return
    setInput(suggestion)
    // Submit directly
    setMessages(prev => [...prev, { role: 'user', content: suggestion }])
    const chatRequest: RAGChatRequest = {
      messages: [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: suggestion },
      ],
      session_id: filters.session_id,
      agent_type: filters.agent_type,
      top_k: 5,
      temperature: 0.7,
    }
    setIsLoading(true)
    chatMutation.mutate(chatRequest)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RAG 智能问答</h1>
          <p className="text-gray-500 mt-1">基于你的 Agent 日志上下文进行智能问答</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            disabled={messages.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            清空对话
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary', showFilters && 'bg-primary-50 text-primary-700')}
          >
            <Filter className="h-4 w-4 mr-2" />
            筛选上下文
          </button>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">上下文筛选</h3>
            <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
              <input
                type="text"
                placeholder="可选：限定特定会话"
                value={filters.session_id || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, session_id: e.target.value || undefined }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent 类型</label>
              <select
                value={filters.agent_type || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, agent_type: e.target.value || undefined }))}
                className="input"
              >
                <option value="">全部</option>
                <option value="opencode">opencode</option>
                <option value="claude">claude</option>
                <option value="codex">codex</option>
                <option value="gemini">gemini</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({})}
                className="btn-ghost text-sm"
              >
                <X className="h-4 w-4 mr-1" />
                清除筛选
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2" role="log" aria-live="polite">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">开始提问吧</p>
            <p className="text-sm mt-1">我会基于你的 Agent 执行日志提供回答</p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center text-sm">
              {[
                '总结最近的开发任务',
                '查找关于 Docker 部署的记录',
                '有哪些待办事项？',
                '解释最后一次 RAG 实现的细节',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(suggestion)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage
            key={index}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
          />
        ))}

        {isLoading && (
          <ChatMessage
            role="assistant"
            content="正在思考..."
            isStreaming={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="card p-4 mt-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="输入问题... (Shift+Enter 换行)"
            disabled={isLoading}
            rows={1}
            className="flex-1 input resize-none min-h-[44px] max-h-32"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-primary self-end mb-1 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-right">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  )
}