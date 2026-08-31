import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Clock, CalendarDays, Inbox, Tag as TagIcon, Pencil, Check, Search } from 'lucide-react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { markdownApi, type MarkdownLog } from '../../services/api'
import { clsx } from 'clsx'
import { useNavigate } from '@tanstack/react-router'

const PAGE_SIZE = 20

function hashName(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

const GRADIENTS = [
  'from-violet-500 to-indigo-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-pink-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-blue-500',
  'from-fuchsia-500 to-purple-500',
]

function gradientFor(name: string) {
  return GRADIENTS[hashName(name) % GRADIENTS.length]
}

function initials(name: string) {
  return (name || '?').slice(0, 2).toUpperCase()
}

function fmtDate(d: string) {
  try {
    const date = new Date(d)
    if (isToday(date)) return '今天'
    if (isYesterday(date)) return '昨天'
    return format(date, 'MM月dd日', { locale: zhCN })
  } catch { return d }
}

function fmtFullDate(d: string) {
  try { return format(new Date(d), 'yyyy年MM月dd日', { locale: zhCN }) } catch { return d }
}

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN }) } catch { return '' }
}

function displayName(log: MarkdownLog) {
  return log.agent_name || log.agent_type || 'Unknown'
}

function groupByDate(items: MarkdownLog[]) {
  const groups: { label: string; items: MarkdownLog[] }[] = []
  let lastLabel = ''
  for (const item of items) {
    const label = fmtFullDate(item.log_date)
    if (label !== lastLabel) {
      groups.push({ label, items: [] })
      lastLabel = label
    }
    groups[groups.length - 1].items.push(item)
  }
  return groups
}

function LogCard({ log, onEdit }: { log: MarkdownLog; onEdit: (l: MarkdownLog) => void }) {
  const name = displayName(log)
  const tags = (log.front_matter?.tags as string[] | undefined) ?? []
  const title = log.title || log.file_path.split('/').pop()?.replace('.md', '') || '无标题'
  const summary = log.summary?.trim() ?? ''

  return (
    <article className="group relative flex gap-4 bg-white px-5 py-5 transition-colors hover:bg-gray-50/60">
      {/* timeline rail */}
      <div className="relative flex shrink-0 flex-col items-center">
        <div className={clsx('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm ring-4 ring-white', gradientFor(name))}>
          {initials(name)}
        </div>
        <div className="mt-2 w-px flex-1 bg-gray-100 group-last:hidden" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{name}</span>
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white">{log.agent_type}</span>
          <span className="text-xs text-gray-400">·</span>
          <time className="text-xs text-gray-400" title={log.log_date}>{timeAgo(log.created_at)}</time>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(log) }}
            className="ml-auto hidden items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500 shadow-sm ring-1 ring-gray-200 hover:bg-gray-900 hover:text-white group-hover:inline-flex md:inline-flex md:opacity-0 md:group-hover:opacity-100 transition"
          >
            <Pencil className="h-3 w-3" /> 编辑
          </button>
        </div>

        <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-gray-900">
          {title}
        </h3>

        {summary ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-600">{summary}</p>
        ) : log.content ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">{log.content.slice(0, 150).replace(/[#*`>\n]+/g, ' ').trim()}…</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> {fmtDate(log.log_date)}
          </span>
          {!!log.tokens_estimate && log.tokens_estimate > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{log.tokens_estimate >= 1000 ? `${(log.tokens_estimate / 1000).toFixed(1)}k` : log.tokens_estimate}</span>
            </>
          )}
          {tags.length > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                {tags.slice(0, 3).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    <TagIcon className="h-3 w-3 opacity-60" />{t}
                  </span>
                ))}
                {tags.length > 3 && <span className="text-gray-400">+{tags.length - 3}</span>}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

export function LogFeed() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterTag, setFilterTag] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
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
    queryKey: ['markdown-logs-feed', filterTag, query],
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 1
      return markdownApi.list({ page, page_size: PAGE_SIZE, tags: filterTag ? [filterTag] : undefined, query: query || undefined })
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.items.length < PAGE_SIZE) return undefined
      return allPages.length + 1
    },
    initialPageParam: 1,
  })

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(onIntersect, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [onIntersect])

  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['markdown-logs-feed'] })
    window.addEventListener('alp:invalidate-logs', invalidate)
    return () => window.removeEventListener('alp:invalidate-logs', invalidate)
  }, [queryClient])

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0
  const isEmpty = !isLoading && items.length === 0
  const groups = groupByDate(items)

  return (
    <div className="mx-auto max-w-[640px]">
      {/* header */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">动态</h1>
          <span className="text-xs font-medium text-gray-400">{total} 条记录</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">所有 Agent 的工作时间轴 · 按时间倒序 · 像朋友圈一样浏览</p>
      </div>

      {/* search + filter */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-y border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 md:mx-0 md:rounded-2xl md:border md:px-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、摘要…"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            {[
              { label: '全部', value: undefined },
              ...['docker', 'deploy', 'fix', 'feat', 'refactor'].map((t) => ({ label: `#${t}`, value: t })),
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setFilterTag(opt.value)}
                className={clsx(
                  'shrink-0 rounded-full px-3 py-2 text-xs font-medium transition',
                  filterTag === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:hidden">
          {[
            { label: '全部', value: undefined },
            ...['docker', 'deploy', 'fix', 'feat', 'refactor'].map((t) => ({ label: `#${t}`, value: t })),
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setFilterTag(opt.value)}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium',
                filterTag === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* feed */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 p-5">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-50" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center">
            <p className="text-sm text-red-600">加载失败，请重试</p>
            <button onClick={() => refetch()} className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white">重试</button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
              <Inbox className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium text-gray-900">还没有动态</p>
              <p className="mt-1 text-sm text-gray-500">Agent 通过 MCP 写入后会实时出现在这里</p>
            </div>
          </div>
        ) : (
          <div>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="sticky top-[57px] z-[1] border-y border-gray-100 bg-gray-50/80 px-5 py-2 text-xs font-medium text-gray-500 backdrop-blur">
                  {group.label}
                </div>
                <div className="divide-y divide-gray-50">
                  {group.items.map((log) => (
                    <LogCard key={log.id} log={log} onEdit={(l) => navigate({ to: '/logs/editor/$logId', params: { logId: l.id } })} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={sentinelRef} className="h-px" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 border-t border-gray-100 py-6 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载更多…
              </div>
            )}
            {!hasNextPage && (
              <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50/50 py-6 text-xs text-gray-400">
                <Check className="h-3.5 w-3.5" /> 已加载全部 {total} 条 · 到底啦
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">下拉自动加载更多 · 支持全文搜索与标签筛选</p>
    </div>
  )
}
