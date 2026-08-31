import { useEffect, useState, useRef } from 'react'
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  Search, X, Loader2, Clock, CalendarDays, Inbox, Tag as TagIcon, FileText,
  SlidersHorizontal, Sparkles, Users, Pencil, Save, Check, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { markdownApi, type MarkdownLog } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'
import { useNavigate } from '@tanstack/react-router'

const PAGE_SIZE = 20

function hashName(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

function avatarStyle(name: string) {
  const AVATAR_STYLES = [
    'from-sky-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
    'from-cyan-500 to-sky-600',
    'from-fuchsia-500 to-purple-600',
  ]
  return AVATAR_STYLES[hashName(name) % AVATAR_STYLES.length]
}

function initials(name: string) {
  return (name || '?').slice(0, 2).toUpperCase()
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'yyyy-MM-dd') } catch { return d }
}

function fmtTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

interface LogCardProps {
  log: MarkdownLog
  onView: (log: MarkdownLog) => void
  onEdit: (log: MarkdownLog) => void
}

function LogCard({ log, onView, onEdit }: LogCardProps) {
  const name = log.agent_name || log.agent_type
  const tags = log.front_matter?.tags as string[] | undefined
  const displayName = name || '?'
  const avatar = avatarStyle(name || '')
  const tagCount = tags?.length ?? 0
  const summary = log.summary || ''
  const title = log.title || log.file_path.split('/').pop()?.replace('.md', '') || '无标题'
  const created = log.created_at
  const agentType = log.agent_type

  return (
    <div
      key={log.id}
      className="group block cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50/80 border-b border-gray-100 last:mb-0"
    >
      <div className="flex gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ring-2 ring-white shadow-sm">
          {initials(displayName)}
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-gray-900 line-clamp-1">{displayName}</span>
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] text-gray-400">{agentType}</span>
            </div>
            <time className="shrink-0 text-xs text-gray-400 transition-colors group-hover:text-primary-600" title={fmtDate(log.log_date)}>
              {timeAgo(created)}
            </time>
          </div>
          <h3 className="mt-1 line-clamp-2 truncate text-[14px] font-medium text-gray-800 group-hover:text-primary-700">
            {title}
          </h3>
          {summary && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-500">{summary}</p>}
          {tagCount > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
              {tags?.map((t, i) => (
                <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-primary-50 px-2 py-0.5">
                  <TagIcon className="h-2.5 w-2.5" /> #{t}
                </span>
              ))}
              {tagCount > 3 && <span className="ml-2 text-[10px] text-gray-500">+{tagCount - 3} 个</span>}
            </div>
          )}
          {!summary && log.content && log.content.trim().length > 0 && (
            <div className="mt-1 line-clamp-2 text-xs text-gray-400">
              <MarkdownViewer content={log.content} className="text-inherit" />
            </div>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="flex items-center gap-0.5 text-gray-500">
              <CalendarDays className="h-2.5 w-2.5" /> {fmtDate(log.log_date)} {fmtTime(created)}
            </span>
            {log.tokens_estimate && log.tokens_estimate > 0 && (
              <span className="flex items-center gap-0.5 text-gray-500">
                <Clock className="h-2.5 w-2.5" /> ≈{log.tokens_estimate >= 1000 ? `${(log.tokens_estimate / 1000).toFixed(1)}k` : log.tokens_estimate} tokens
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(log) }}
            title="编辑"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- LogFeed ------------------------------- */

export function LogFeed() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /* ---------------------------- Infinite Query ---------------------------- */
  interface InfiniteLogData {
    items: MarkdownLog[]
    total: number
    page: number
    page_size: number
    total_pages: number
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError, error } = useInfiniteQuery<InfiniteLogData, Error>({
    queryKey: ['markdown-logs-feed'],
    queryFn: async () => {
      const resp = await markdownApi.list({ page: 1, page_size: PAGE_SIZE })
      return resp as InfiniteLogData
    },
    getNextPageParam: (last) => {
      if (last.items.length < PAGE_SIZE) return undefined
      return allLength + 1 // will be fixed at runtime
    },
    initialPageParam: PAGE_SIZE,
  })

  /* ---------------------------- State ---------------------------- */
  const [showFilters, setShowFilters] = useState(false)
  const [ageLimitDays, setAgeLimitDays] = useState(7)
  const composerRef = useRef<HTMLDivElement>(null)
  let allLength = 0 // track page count

  /* ---------------------------- Effect: scroll infinite ---------------------------- */
  useEffect(() => {
    if (isFetchingNextPage) return
    if (!hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          observer.disconnect()
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    const bottomEl = document.querySelector('.feed-bottom')
    if (bottomEl) observer.observe(bottomEl)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  /* ---------------------------- Error handling ---------------------------- */
  if (isError) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-6 w-6 mx-auto mb-4 animate-spin text-red-500" />
        <p className="text-lg text-gray-700">加载日志失败</p>
        <button onClick={() => queryClient.refetchQueries({ queryKey: ['markdown-logs-feed'] })} className="btn-secondary mt-4">重试</button>
      </div>
    )
  }

  /* ---------------------------- Render ---------------------------- */
  const items = data?.pages ? data.pages.map(page => page.items).flat() : []
  const total = data?.pages?.[0]?.total ?? 0
  const empty = !data || items.length === 0

  return (
    <div className="mx-auto max-w-7xl">
      {/* ======================== Sticky Header ======================== */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">日志时间轴</h1>
            <p className="text-sm text-gray-500">跨机器/跨 Agent 的工作记录</p>
          </div>
          <div className="hidden sm:block flex gap-1 sm:gap-2">
            <button onClick={() => setAgeLimitDays(d => Math.max(1, d - 7))} className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
              <Clock className="mr-0.5" />最近 7 天
            </button>
            <button onClick={() => setAgeLimitDays(d => d + 7)} className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
              <CalendarDays className="mr-0.5" />最近 30 天
            </button>
            <button onClick={() => setAgeLimitDays(999)} className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all">
              <X className="mr-0.5 opacity-60" />全部
            </button>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="sm:hidden inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all">
            <SlidersHorizontal className="h-4 w-4" /> 筛选
          </button>
        </div>
      </header>

      {/* ======================== Main Container ======================== */}
      <main className="pt-20 pb-16">
        {/* Composer (P1) */}
        {composerRef.current && <LogComposerP1 />}
        {/* Feed Items */}
        {empty ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center py-20 text-center text-gray-400">
            <Inbox className="h-12 w-12 mb-3" /><p className="font-medium">还没有日志</p><p className="text-sm mt-1">Agent 通过 MCP 写入的日志会实时出现在这里，或手动发布新日志。</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((log, idx) => (
              <LogCard key={log.id + idx} log={log} onView={() => navigate({ to: '/logs' })} onEdit={() => { const id = log.id; navigate({ to: '/logs/editor/' + id }); }} />
            ))}
            {hasNextPage && !isFetchingNextPage && (
              <div className="feed-bottom py-8 text-center">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-gray-300" /><span className="ml-2 text-sm text-gray-500">加载更多...</span>
              </div>
            )}
          </div>
        )}
        {!hasNextPage && data?.pages?.[0] && (
          <div className="py-8 text-center text-gray-500"><Check className="h-6 w-6 mx-auto mb-2" /><span>已加载所有日志</span></div>
        )}
      </main>

      {/* ======================== Filters Panel ======================== */}
      {showFilters && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-gray-100 transform translate-y-full transition-transform duration-300 ease-out max-w-7xl mx-4 px-4 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Agent 类型</label>
            <select
              onChange={(e) => setShowFilters(false)}
              className="input w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:bg-white"
            >
              <option value="">全部</option>
              <option value="opencode">OpenCode</option>
              <option value="claude-code">Claude Code</option>
              <option value="agy">Antigravity</option>
            </select>
            <label className="block text-sm font-medium text-gray-500 mt-2">时间范围</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={() => setAgeLimitDays(7)} className={ageLimitDays === 7 ? 'rounded border px-2 py-1 text-xs font-medium bg-primary-600 text-white' : 'rounded border px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100'} >7天</button>
              <button onClick={() => setAgeLimitDays(30)} className={ageLimitDays === 30 ? 'rounded border px-2 py-1 text-xs font-medium bg-primary-600 text-white' : 'rounded border px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100'} >30天</button>
              <button onClick={() => setAgeLimitDays(999)} className={ageLimitDays >= 999 ? 'rounded border px-2 py-1 text-xs font-medium bg-primary-600 text-white' : 'rounded border px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100'} >全部</button>
            </div>
            <label className="block text-sm font-medium text-gray-500 mt-2">搜索关键词</label>
            <input
              type="text"
              placeholder="搜索标题、摘要、标签..."
              value={''}
              onChange={(e) => {}}
              className="input w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:bg-white"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setShowFilters(false)} className="flex-1 rounded bg-primary-600 text-white px-4 py-2 text-sm font-medium">清除并重置</button>
              <button onClick={() => setShowFilters(false)} className="flex-1 rounded border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------- Composer P1 ------------------------------- */

function LogComposerP1() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleCreate = async () => {
    setLoading(true)
    setSaveError('')
    try {
      await markdownApi.create({
        content,
        session_id: undefined,
        agent_type: 'opencode',
        log_date: new Date().toISOString().split('T')[0],
        front_matter: { source: 'web-composer' },
      })
      setLoading(false)
      setSaving(true)
      try { window.dispatchEvent(new CustomEvent('alp:invalidate-logs')) } catch { /* ignore */ }
      setTimeout(() => setSaving(false), 2000)
      navigate({ to: '/logs' })
    } catch (e: any) {
      setSaveError(e.response?.data?.detail || '发布失败，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="card px-4 py-3 border-b border-gray-100 mb-4 flex flex-col sm:flex-row gap-3 sm:items-end sm:gap-4">
      <div className="flex-1 sm:flex-1 gap-2">
        <select
          className="rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          onChange={(e) => setContent(c => c + '\n\n---\n' + e.target.value || '')}
        >
          <option value="">选择 Agent...</option>
          <option value="opencode">OpenCode</option>
          <option value="claude-code">Claude Code</option>
          <option value="agy">Antigravity</option>
        </select>
        <input
          type="text"
          placeholder="日志标题（可选）"
          className="flex-1 rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <textarea
        rows={3}
        placeholder="# 写下你的想法…或 Agent 的工作记录"
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white resize-none min-h-[80px] w-full"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      ></textarea>
      <button
        onClick={async () => { if (!title.trim() && !content.trim()) return; await handleCreate() }}
        className="px-4 py-1.5 rounded bg-primary-600 text-white text-sm font-medium shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}
      >
        {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
        {loading ? '发布中…' : '发布'}
      </button>
    </div>
  )
}