import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Filter, Tag as TagIcon, Download, FileText, Clock, ChevronRight, ChevronLeft,
  X, Inbox, SlidersHorizontal, Sparkles, Users, CalendarDays, Pencil, Loader2,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { markdownApi, type MarkdownLog, type MarkdownLogSearchParams } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'
import { useNavigate } from '@tanstack/react-router'

const PAGE_SIZES = [10, 20, 50]

/* ---------------------------- 工具函数 ---------------------------- */

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

function hashName(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

function avatarStyle(name: string) {
  return AVATAR_STYLES[hashName(name) % AVATAR_STYLES.length]
}

function initials(name: string) {
  return (name || '?').slice(0, 2).toUpperCase()
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'yyyy-MM-dd') } catch { return d }
}

function fmtTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

function displayName(log: MarkdownLog) {
  return log.agent_name || log.agent_type
}

/* ---------------------------- 全文懒加载容器 ---------------------------- */

function FullLogView({ log }: { log: MarkdownLog }) {
  const [full, setFull] = useState<MarkdownLog | null>(log.content !== undefined ? log : null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setFull(log.content !== undefined ? log : null)
    setErr('')
  }, [log])

  useEffect(() => {
    if (full) return
    let alive = true
    markdownApi.get(log.id)
      .then(data => { if (alive) setFull(data) })
      .catch(e => { if (alive) setErr(e.response?.data?.detail || '加载失败') })
    return () => { alive = false }
  }, [full, log])

  if (err) return <div className="flex flex-1 items-center justify-center text-sm text-red-500">{err}</div>
  if (!full) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-10 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载全文中…
      </div>
    )
  }

  const tags = full.front_matter?.tags as string[] | undefined
  return (
    <>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-gray-50 bg-gray-50/50 px-6 py-2.5">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-primary-100">
              <TagIcon className="h-3 w-3" />
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto px-6 py-5 scrollbar-thin">
        <MarkdownViewer content={full.content || '*（空日志）*'} />
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-6 py-2.5">
        <span className="truncate font-mono text-[11px] text-gray-300">{full.file_path}</span>
        <span className="shrink-0 text-[11px] text-gray-300">点击右上角「编辑」进入全屏分屏编辑</span>
      </div>
    </>
  )
}

/* ---------------------------------- 主组件 ---------------------------------- */

export function LogsList() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useState<MarkdownLogSearchParams>({
    page: 1,
    page_size: 20,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState<MarkdownLog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['markdown-logs', searchParams],
    queryFn: () => markdownApi.list(searchParams),
    placeholderData: (previous) => previous,
  })

  // 全屏编辑器保存后刷新列表
  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['markdown-logs'] })
    window.addEventListener('alp:invalidate-logs', invalidate)
    return () => window.removeEventListener('alp:invalidate-logs', invalidate)
  }, [queryClient])

  /* ------------------------------ 操作 ------------------------------ */

  const handleFilterChange = (key: keyof MarkdownLogSearchParams, value: any) => {
    setSearchParams(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setSearchParams(prev => ({ ...prev, page }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openEditor = (log: MarkdownLog) => {
    navigate({ to: '/logs/editor/$logId', params: { logId: log.id } })
  }

  const handleExport = async () => {
    if (!data) return
    const resp = await markdownApi.list({ ...searchParams, page_size: 1000 })
    const content = resp.items.map(log =>
      `---\n${JSON.stringify(log.front_matter, null, 2)}\n---\n\n${log.content || ''}`
    ).join('\n\n---\n\n')
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-logs-${format(new Date(), 'yyyy-MM-dd')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const agentTypes = data ? Array.from(new Set(data.items.map(l => l.agent_type))).sort() : []
  const activeFilterCount =
    (searchParams.agent_type ? 1 : 0) +
    (searchParams.start_date ? 1 : 0) +
    (searchParams.end_date ? 1 : 0) +
    (searchParams.tags?.length ? 1 : 0)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const stats = data ? [
    { label: '日志总数', value: String(data.total), icon: FileText, tone: 'bg-sky-50 text-sky-600' },
    { label: '今日新增', value: String(data.items.filter(l => l.log_date === todayStr).length), icon: Sparkles, tone: 'bg-emerald-50 text-emerald-600' },
    { label: '活跃 Agent', value: String(new Set(data.items.map(displayName)).size), icon: Users, tone: 'bg-violet-50 text-violet-600' },
    { label: 'Tokens 总量', value: `${(data.items.reduce((s, l) => s + (l.tokens_estimate || 0), 0) / 1000).toFixed(1)}k`, icon: Clock, tone: 'bg-amber-50 text-amber-600' },
  ] : []

  /* ------------------------------ 渲染 ------------------------------ */

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* 页头 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">日志列表</h1>
            <p className="text-sm text-gray-500">所有 Agent 的工作记录 · 点击行内 ✏️ 进入全屏编辑</p>
          </div>
        </div>
        <button onClick={handleExport} className="btn-secondary self-start sm:self-auto">
          <Download className="mr-1.5 h-4 w-4" />
          导出
        </button>
      </div>

      {/* 统计卡片 */}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="card flex items-center gap-3 p-4">
              <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.tone)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-gray-500">{s.label}</div>
                <div className="text-xl font-bold tabular-nums text-gray-900">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 搜索 + 筛选栏 */}
      <div className="card p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索日志标题、摘要…"
              value={searchParams.query || ''}
              onChange={(e) => handleFilterChange('query', e.target.value || undefined)}
              className="input border-transparent bg-gray-50 pl-9 focus:border-primary-500 focus:bg-white"
            />
            {searchParams.query && (
              <button
                onClick={() => handleFilterChange('query', undefined)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all',
              showFilters || activeFilterCount > 0
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            筛选
            {activeFilterCount > 0 && (
              <span className={clsx(
                'ml-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                showFilters ? 'bg-white/25 text-white' : 'bg-primary-600 text-white',
              )}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Agent 类型</label>
              <select
                value={searchParams.agent_type || ''}
                onChange={(e) => handleFilterChange('agent_type', e.target.value || undefined)}
                className="input"
              >
                <option value="">全部</option>
                {agentTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">开始日期</label>
              <input type="date" value={searchParams.start_date || ''} onChange={(e) => handleFilterChange('start_date', e.target.value || undefined)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">结束日期</label>
              <input type="date" value={searchParams.end_date || ''} onChange={(e) => handleFilterChange('end_date', e.target.value || undefined)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">标签</label>
              <input
                type="text"
                placeholder="docker, rag"
                value={searchParams.tags?.join(', ') || ''}
                onChange={(e) => handleFilterChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean) || undefined)}
                className="input"
              />
            </div>
          </div>
        )}
      </div>

      {/* 日志 Feed 流 */}
      <div className="card">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 p-5">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-50" />
                  </div>
                  <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-gray-50" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-gray-50" />
                </div>
              </div>
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 text-gray-300">
              <Inbox className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{searchParams.query || activeFilterCount > 0 ? '没有匹配的日志' : '还没有日志'}</p>
              <p className="mt-1 text-sm text-gray-500">
                {searchParams.query || activeFilterCount > 0 ? '试试调整搜索关键词或清除筛选条件' : 'Agent 通过 MCP 写入的日志会实时出现在这里'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
              <span className="text-xs text-gray-400">
                共 <span className="font-semibold text-gray-600">{data.total}</span> 条 · 第 {data.page}/{data.total_pages} 页
              </span>
              <select
                value={searchParams.page_size}
                onChange={(e) => handleFilterChange('page_size', parseInt(e.target.value))}
                className="cursor-pointer rounded-md border-0 bg-transparent pr-6 text-xs text-gray-500 focus:ring-0"
              >
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} 条/页</option>)}
              </select>
            </div>

            <div className="divide-y divide-gray-100">
              {data.items.map(log => {
                const name = displayName(log)
                const tags = log.front_matter?.tags as string[] | undefined
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="group block cursor-pointer px-5 py-4 transition-colors hover:bg-gray-50/80"
                  >
                    <div className="flex gap-4">
                      <div className={clsx(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ring-2 ring-white shadow-sm',
                        avatarStyle(name),
                      )}>
                        {initials(name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900">{name}</span>
                            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px font-mono text-[10px] text-gray-400">
                              {log.agent_type}
                            </span>
                          </div>
                          <time className="shrink-0 text-xs text-gray-400 transition-colors group-hover:text-primary-600" title={fmtDate(log.log_date)}>
                            {timeAgo(log.created_at)}
                          </time>
                        </div>

                        <h3 className="mt-1 truncate text-[15px] font-medium text-gray-800 group-hover:text-primary-700">
                          {log.title || log.file_path.split('/').pop()?.replace('.md', '') || '无标题日志'}
                        </h3>

                        {log.summary && (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{log.summary}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {fmtDate(log.log_date)} {fmtTime(log.created_at)}
                          </span>
                          {!!log.tokens_estimate && log.tokens_estimate > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ≈{log.tokens_estimate >= 1000 ? `${(log.tokens_estimate / 1000).toFixed(1)}k` : log.tokens_estimate} tokens
                            </span>
                          )}
                          {tags && tags.length > 0 && (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              {tags.slice(0, 3).map(t => (
                                <span key={t} className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-600">
                                  #{t}
                                </span>
                              ))}
                              {tags.length > 3 && (
                                <span className="text-[11px] text-gray-400">+{tags.length - 3}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditor(log) }}
                          title="全屏编辑"
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {data.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                <button
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page === 1}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />上一页
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(data.total_pages, 7) }, (_, i) => {
                    let pageNum: number
                    if (data.total_pages <= 7) pageNum = i + 1
                    else if (data.page <= 4) pageNum = i + 1
                    else if (data.page >= data.total_pages - 3) pageNum = data.total_pages - 6 + i
                    else pageNum = data.page - 3 + i
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={clsx(
                          'h-8 min-w-8 rounded-lg px-1 text-sm font-medium tabular-nums transition-colors',
                          data.page === pageNum
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'text-gray-500 hover:bg-gray-100',
                        )}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page === data.total_pages}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  下一页<ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════ 详情弹窗（只读） ═══════════ */}
      {selectedLog && (() => {
        const name = displayName(selectedLog)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />

            <div className="modal-pop relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5">
              {/* 弹窗头 */}
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={clsx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white',
                    avatarStyle(name),
                  )}>
                    {initials(name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-gray-900">
                      {selectedLog.title || selectedLog.file_path.split('/').pop()?.replace('.md', '') || '无标题日志'}
                    </h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{name}</span>
                      <span>·</span>
                      <span>{fmtDate(selectedLog.log_date)} {format(new Date(selectedLog.created_at), 'HH:mm:ss')}</span>
                      {!!selectedLog.tokens_estimate && selectedLog.tokens_estimate > 0 && (
                        <>
                          <span>·</span>
                          <span>≈{selectedLog.tokens_estimate >= 1000 ? `${(selectedLog.tokens_estimate / 1000).toFixed(1)}k` : selectedLog.tokens_estimate} tokens</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEditor(selectedLog)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />编辑
                  </button>
                  <button onClick={() => setSelectedLog(null)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <FullLogView log={selectedLog} />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
