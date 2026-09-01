import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loader2, Clock, CalendarDays, Inbox, Tag as TagIcon, Check, Search, Eye, X, Copy, FileText } from 'lucide-react'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { markdownApi, type MarkdownLog } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'

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
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMM dd', { locale: enUS })
  } catch { return d }
}

function fmtFullDate(d: string) {
  try { return format(new Date(d), 'MMM dd, yyyy', { locale: enUS }) } catch { return d }
}

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: enUS }) } catch { return '' }
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

function LogCard({ log, onView }: { log: MarkdownLog; onView: (l: MarkdownLog) => void }) {
  const name = displayName(log)
  const tags = (log.front_matter?.tags as string[] | undefined) ?? []
  const title = log.title || log.file_path.split('/').pop()?.replace('.md', '') || 'Untitled'
  const summary = log.summary?.trim() ?? ''

  return (
    <article
      onClick={() => onView(log)}
      className="group relative flex cursor-pointer gap-4 bg-white px-5 py-5 transition-colors hover:bg-gray-50/80"
    >
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
          <span className="ml-auto hidden items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white shadow-sm group-hover:inline-flex md:inline-flex md:opacity-0 md:group-hover:opacity-100 transition">
            <Eye className="h-3 w-3" /> Preview
          </span>
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

function LogPreviewModal({ logId, onClose }: { logId: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const { data: log, isLoading, isError } = useQuery({
    queryKey: ['markdown-log', logId],
    queryFn: () => markdownApi.get(logId!),
    enabled: !!logId,
  })

  useEffect(() => {
    if (!logId) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [logId, onClose])

  const handleCopy = async () => {
    if (!log?.content) return
    try {
      await navigator.clipboard.writeText(log.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (!logId) return null

  const name = log ? displayName(log) : ''
  const title = log ? (log.title || log.file_path.split('/').pop()?.replace('.md', '') || 'Untitled') : ''
  const tags = (log?.front_matter?.tags as string[] | undefined) ?? []
  const createdLabel = log ? format(new Date(log.created_at), 'MMM dd, yyyy · HH:mm', { locale: enUS }) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5">
        {/* Thin gradient accent */}
        <div className={clsx('h-1.5 w-full bg-gradient-to-r', log ? gradientFor(name) : 'from-gray-800 to-gray-900')} />
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content - single scroll, no overlapping hero */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-6 pb-6 pt-6 sm:px-8 sm:pt-7">
          {isLoading ? (
            <div className="space-y-4 py-10">
              <div className="h-5 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-50" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-gray-50" />
            </div>
          ) : isError || !log ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-600">Failed to load log</p>
              <button onClick={onClose} className="mt-3 btn-secondary text-sm">Close</button>
            </div>
          ) : (
            <>
              {/* Header: avatar + title */}
              <div className="flex gap-4">
                <div className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm', log ? gradientFor(name) : 'from-gray-700 to-gray-800')}>
                  {log ? initials(name) : '…'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{log ? name : 'Loading…'}</span>
                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white">{log?.agent_type ?? '—'}</span>
                    <span className="hidden text-xs text-gray-400 sm:inline">· {createdLabel}</span>
                    <button
                      onClick={handleCopy}
                      disabled={!log?.content}
                      className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40 sm:inline-flex"
                    >
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy Markdown</>}
                    </button>
                  </div>
                  <h2 className="mt-1.5 text-xl font-bold leading-tight tracking-tight text-gray-900">{log ? title : 'Loading…'}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{log ? timeAgo(log.created_at) : ''}</span>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{log ? fmtFullDate(log.log_date) : ''}</span>
                  </div>
                </div>
              </div>

              {/* Meta bar */}
              <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-gray-100 py-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-500">
                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                  {log.file_path}
                </span>
                {!!log.tokens_estimate && log.tokens_estimate > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <Clock className="h-3.5 w-3.5" /> {log.tokens_estimate >= 1000 ? `${(log.tokens_estimate/1000).toFixed(1)}k` : log.tokens_estimate} tokens
                    </span>
                  </>
                )}
                <span className="ml-auto inline-flex items-center gap-1.5 sm:hidden">
                  <button onClick={handleCopy} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </span>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
                      <TagIcon className="h-3 w-3 opacity-60" /> {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Summary callout */}
              {log.summary && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Summary</div>
                  <p className="mt-1 text-sm leading-relaxed text-amber-900">{log.summary}</p>
                </div>
              )}

              {/* Markdown */}
              <MarkdownViewer content={log.content || ''} />

              {/* Footer */}
              <div className="mt-10 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
                <span>Agent: {displayName(log)} · {log.agent_type}</span>
                <span>{log.front_matter ? Object.keys(log.front_matter).length + ' meta fields' : ''}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}


export function LogFeed() {
  const queryClient = useQueryClient()
  const [previewId, setPreviewId] = useState<string | null>(null)
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
      {/* search + filter */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur-md">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, summary..."
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            {[
              { label: 'All', value: undefined },
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
            { label: 'All', value: undefined },
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
      <div className="bg-white -mx-4 md:mx-0">
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
            <p className="text-sm text-red-600">Failed to load, please try again</p>
            <button onClick={() => refetch()} className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-sm text-white">Retry</button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
              <Inbox className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium text-gray-900">No activity yet</p>
              <p className="mt-1 text-sm text-gray-500">Logs written by Agents via MCP will appear here in real time</p>
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
                    <LogCard key={log.id} log={log} onView={(l) => setPreviewId(l.id)} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={sentinelRef} className="h-px" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 border-t border-gray-100 py-6 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more...
              </div>
            )}
            {!hasNextPage && (
              <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50/50 py-6 text-xs text-gray-400">
                <Check className="h-3.5 w-3.5" /> All {total} items loaded · End
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">Scroll to load more · Full-text search and tag filtering supported</p>

      <LogPreviewModal logId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  )
}
