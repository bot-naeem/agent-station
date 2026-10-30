import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowLeft, ArrowRight, Calendar, ExternalLink, FileText, Globe, Loader2,
  Plus, Search, StickyNote, Video, X,
} from 'lucide-react'
import { clipApi, type Clip, type ClipSourceType, type ClipStatus } from '../../services/api'
import { clsx } from 'clsx'

const PAGE_SIZE = 12

const SOURCE_META: Record<ClipSourceType, { label: string; icon: typeof Globe; className: string }> = {
  web: { label: 'Web', icon: Globe, className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  video: { label: 'Video', icon: Video, className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  note: { label: 'Note', icon: StickyNote, className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  other: { label: 'Other', icon: FileText, className: 'bg-gray-50 text-gray-600 ring-gray-200' },
}

const STATUS_META: Record<ClipStatus, string> = {
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  draft: 'bg-amber-50 text-amber-700 ring-amber-100',
  archived: 'bg-gray-100 text-gray-600 ring-gray-200',
}

interface ClipSearch {
  query?: string
  category?: string
  tag?: string
  source_type?: ClipSourceType
  status?: ClipStatus
  page?: number
  [key: string]: string | number | undefined
}

function sourceMeta(type: string) {
  return SOURCE_META[(type as ClipSourceType)] || SOURCE_META.other
}

export function ClipsList() {
  const search = useSearch({ strict: false }) as ClipSearch
  const navigate = useNavigate()
  const [queryInput, setQueryInput] = useState(search.query || '')
  const page = Number(search.page || 1)

  const [filters, setFilters] = useState<{
    query: string
    category: string
    tag: string
    source_type: string
    status: string
  }>({
    query: search.query || '',
    category: search.category || '',
    tag: search.tag || '',
    source_type: search.source_type || '',
    status: search.status || '',
  })

  useEffect(() => {
    setFilters({
      query: search.query || '',
      category: search.category || '',
      tag: search.tag || '',
      source_type: search.source_type || '',
      status: search.status || '',
    })
    setQueryInput(search.query || '')
  }, [search.query, search.category, search.tag, search.source_type, search.status])

  const { data, isLoading } = useQuery({
    queryKey: ['clips', filters, page],
    queryFn: () => clipApi.list({
      query: filters.query || undefined,
      category: filters.category || undefined,
      tag: filters.tag || undefined,
      source_type: (filters.source_type || undefined) as ClipSourceType | undefined,
      status: (filters.status || undefined) as ClipStatus | undefined,
      page,
      page_size: PAGE_SIZE,
    }),
  })

  const { data: stats } = useQuery({
    queryKey: ['clip-stats'],
    queryFn: () => clipApi.stats(),
  })

  const updateSearch = (patch: Record<string, string | number | undefined>) => {
    const next: ClipSearch = { ...search, ...patch }
    Object.keys(next).forEach((key) => {
      if (next[key] === undefined || next[key] === '') delete next[key]
    })
    navigate({ search: next as any })
  }

  const setFilter = (key: 'category' | 'source_type' | 'status', value: string) => {
    updateSearch({ [key]: value || undefined, page: 1 })
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    updateSearch({ query: queryInput.trim() || undefined, page: 1 })
  }

  const clearAll = () => {
    setQueryInput('')
    navigate({ search: {} as any })
  }

  const hasFilters = Boolean(filters.query || filters.category || filters.tag || filters.source_type || filters.status)
  const totalPages = data?.total_pages ?? 0
  const categories = Object.keys(stats?.by_category ?? {}).sort()

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Clips</h1>
            <p className="text-sm text-gray-500">Web clippings and video transcripts saved by your agents</p>
          </div>
        </div>
        <Link
          to="/clips/editor/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black"
        >
          <Plus className="h-4 w-4" /> New Clip
        </Link>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Clips</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total_clips}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sources</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(stats.by_source_type).map(([type, count]) => {
                const meta = sourceMeta(type)
                return (
                  <span key={type} className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1', meta.className)}>
                    {meta.label} <strong>{count}</strong>
                  </span>
                )
              })}
              {!Object.keys(stats.by_source_type).length && <span className="text-sm text-gray-400">No clips yet</span>}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Categories</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{categories.length}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form onSubmit={submitSearch} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search title, summary or full content..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/5"
            />
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.category}
              onChange={(event) => setFilter('category', event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-300"
            >
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select
              value={filters.source_type}
              onChange={(event) => setFilter('source_type', event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-300"
            >
              <option value="">All sources</option>
              <option value="web">Web</option>
              <option value="video">Video</option>
              <option value="note">Note</option>
              <option value="other">Other</option>
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-300"
            >
              <option value="">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            {filters.tag && (
              <button
                type="button"
                onClick={() => updateSearch({ tag: undefined, page: 1 })}
                className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-2.5 py-2 text-sm font-medium text-white"
              >
                #{filters.tag} <X className="h-3.5 w-3.5" />
              </button>
            )}
            {hasFilters && (
              <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-56 items-center justify-center gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading clips...
        </div>
      ) : !data?.items.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No clips found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {hasFilters ? 'Try clearing the filters.' : 'Agents can save clips with write_clip, or create one here.'}
          </p>
          {!hasFilters && (
            <Link to="/clips/editor/new" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" /> New Clip
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((clip) => (
              <ClipCard key={clip.id} clip={clip} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Prev
              </button>
              <span className="px-2 text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button
                onClick={() => updateSearch({ page: Math.min(totalPages, page + 1) })}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ClipCard({ clip }: { clip: Clip }) {
  const source = sourceMeta(clip.source_type)
  const SourceIcon = source.icon
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md">
      {clip.cover_image && (
        <Link to="/clips/$clipId" params={{ clipId: clip.id } as any}>
          <img src={clip.cover_image} alt={clip.title} className="h-40 w-full object-cover" />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', source.className)}>
            <SourceIcon className="h-3 w-3" /> {source.label}
          </span>
          {clip.category && (
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-100">
              {clip.category}
            </span>
          )}
          <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1', STATUS_META[clip.status] || STATUS_META.draft)}>
            {clip.status}
          </span>
        </div>

        <Link to="/clips/$clipId" params={{ clipId: clip.id } as any}>
          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-gray-900 transition-colors group-hover:text-gray-700">
            {clip.title}
          </h2>
        </Link>
        {clip.summary && <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-gray-600">{clip.summary}</p>}

        {clip.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {clip.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{tag}</span>
            ))}
            {clip.tags.length > 4 && <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">+{clip.tags.length - 4}</span>}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-50 pt-3 text-xs text-gray-500">
          <span className="truncate">{clip.agent_name || 'Admin'}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> {format(new Date(clip.created_at), 'yyyy-MM-dd')}
          </span>
        </div>
        {clip.source_url && (
          <a
            href={clip.source_url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1 truncate text-[11px] text-gray-400 hover:text-gray-600"
          >
            <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{clip.source_url}</span>
          </a>
        )}
      </div>
    </article>
  )
}
