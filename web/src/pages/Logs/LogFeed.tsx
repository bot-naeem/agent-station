import { useEffect, useState, useRef, useCallback } from 'react'
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  X, Loader2, Clock, CalendarDays, Inbox, Tag as TagIcon,
  SlidersHorizontal, Pencil, Save, Check, ChevronRight,
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
  onEdit: (log: MarkdownLog) => void
}

function LogCard({ log, onEdit }: LogCardProps) {
  const name = log.agent_name || log.agent_type
  const tags = log.front_matter?.tags as string[] | undefined
  const displayName = name || '?'
  const tagCount = tags?.length ?? 0
  const summary = log.summary || ''
  const title = log.title || log.file_path.split('/').pop()?.replace('.md', '') || '无标题'
  const created = log.created_at
  const agentType = log.agent_type

  return (
    <div className="group block cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50/80 border-b border-gray-100 last:border-0">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ring-2 ring-white shadow-sm">
          <span className={clsx('flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br', avatarStyle(name || ''))} style={{ position: 'absolute', width: 36, height: 36, marginLeft: -0 }} />
          <span className="relative">{initials(displayName)}</span>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-gray-900">{displayName}</span>
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] text-gray-400">{agentType}</span>
            </div>
            <time className="shrink-0 text-xs text-gray-400 group-hover:text-primary-600" title={fmtDate(log.log_date)}>
              {timeAgo(created)}
            </time>
          </div>
          <h3 className="line-clamp-2 text-[14px] font-medium text-gray-800 group-hover:text-primary-700">
            {title}
          </h3>
          {summary && <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{summary}</p>}
          {tagCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {tags!.slice(0, 3).map((t) => (
                <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                  <TagIcon className="h-2.5 w-2.5" /> #{t}
                </span>
              ))}
              {tagCount > 3 && <span className="text-xs text-gray-400">+{tagCount - 3}</span>}
            </div>
          )}
          {!summary && log.content && log.content.trim().length > 0 && (
            <div className="line-clamp-2 text-xs text-gray-400">
              <MarkdownViewer content={log.content.slice(0, 300)} className="text-inherit" />
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-2.5 w-2.5" /> {fmtDate(log.log_date)} {fmtTime(created)}
            </span>
            {!!log.tokens_estimate && log.tokens_estimate > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> ≈{log.tokens_estimate >= 1000 ? `${(log.tokens_estimate / 1000).toFixed(1)}k` : log.tokens_estimate} tokens
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(log) }}
            title="编辑"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-primary-50 hover:text-primary-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary-500" />
        </div>
      </div>
    </div>
  )
}

function LogComposer({ onSuccess }: { onSuccess: () => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [agentType, setAgentType] = useState('opencode')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const handleCreate = async () => {
    if (!content.trim() && !title.trim()) return
    setLoading(true)
    setErr('')
    try {
      const fullContent = title.trim() ? `# ${title.trim()}\n\n${content}` : content
      await markdownApi.create({
        content: fullContent || '# 无标题\n\n(空内容)',
        agent_type: agentType,
        log_date: new Date().toISOString().split('T')[0],
        front_matter: { source: 'web-composer' },
      })
      setTitle('')
      setContent('')
      setLoading(false)
      try { window.dispatchEvent(new CustomEvent('alp:invalidate-logs')) } catch { /* ignore */ }
      onSuccess()
    } catch (e: any) {
      setErr(e.response?.data?.detail || '发布失败，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">你</div>
        <span className="text-sm font-medium text-gray-700">发布一条新日志</span>
        <span className="text-xs text-gray-400">像发推一样记录 Agent 的工作</span>
      </div>
      <div className="flex gap-2 mb-2">
        <select
          value={agentType}
          onChange={(e) => setAgentType(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none"
        >
          <option value="opencode">OpenCode</option>
          <option value="claude-code">Claude Code</option>
          <option value="agy">Antigravity</option>
          <option value="codex">Codex</option>
        </select>
        <input
          type="text"
          placeholder="标题（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none"
        />
      </div>
      <textarea
        rows={3}
        placeholder="写下进展、想法、踩坑… 支持 Markdown"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-primary-500 focus:bg-white focus:outline-none resize-none"
      />
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleCreate}
          disabled={loading || (!content.trim() && !title.trim())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {loading ? '发布中…' : '发布'}
        </button>
      </div>
    </div>
  )
}

export function LogFeed() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showFilters, setShowFilters] = useState(false)
  const [filterTag, setFilterTag] = useState<string | undefined>(undefined)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['markdown-logs-feed', filterTag],
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 1
      const resp = await markdownApi.list({ page, page_size: PAGE_SIZE, tags: filterTag ? [filterTag] : undefined })
      return resp
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < PAGE_SIZE) return undefined
      return allPages.length + 1
    },
    initialPageParam: 1,
  })

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(onIntersect, { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [onIntersect])

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['markdown-logs-feed'] })
    window.addEventListener('alp:invalidate-logs', invalidate)
    return () => window.removeEventListener('alp:invalidate-logs', invalidate)
  }, [queryClient])

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <p className="text-sm text-red-600">加载失败</p>
        <button onClick={() => refetch()} className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">重试</button>
      </div>
    )
  }

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0
  const isEmpty = !isLoading && items.length === 0

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">日志时间轴</h1>
          <p className="text-xs text-gray-500">像微博/推特一样浏览 · 每个 Agent 都是一条动态 · 共 {total} 条</p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
            showFilters ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" /> 筛选
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">按标签筛选</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterTag(undefined)}
              className={clsx('rounded-full px-3 py-1 text-xs', !filterTag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600')}
            >
              全部
            </button>
            {['docker', 'rag', 'deploy', 'fix', 'feat'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(t)}
                className={clsx('rounded-full px-3 py-1 text-xs', filterTag === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600')}
              >
                #{t}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setShowFilters(false)} className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm text-white">完成</button>
            <button
              onClick={() => { setFilterTag(undefined); setShowFilters(false) }}
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            >
              清除
            </button>
          </div>
        </div>
      )}

      <LogComposer onSuccess={() => refetch()} />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 p-4">
                <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="font-medium text-gray-900">还没有日志</p>
            <p className="text-sm text-gray-500">在上方发布第一条，或让 Agent 通过 MCP 写入</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((log) => (
              <LogCard key={log.id} log={log} onEdit={(l) => navigate({ to: '/logs/editor/$logId', params: { logId: l.id } })} />
            ))}
            <div ref={sentinelRef} className="h-1" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载更多…
              </div>
            )}
            {!hasNextPage && (
              <div className="flex items-center justify-center gap-1.5 py-6 text-xs text-gray-400">
                <Check className="h-3.5 w-3.5" /> 已加载全部 {total} 条
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
