import { useParams, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Tag as TagIcon, Clock, Copy, Check, FileText, Hash } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { markdownApi } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { useState } from 'react'
import { clsx } from 'clsx'

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
function gradientFor(name: string) { return GRADIENTS[hashName(name) % GRADIENTS.length] }
function initials(name: string) { return (name || '?').slice(0, 2).toUpperCase() }
function displayName(log: any) { return log?.agent_name || log?.agent_type || 'Unknown' }

export function LogDetail() {
  const { date, agent, fileName } = useParams({ from: '/logs/$date/$agent/$fileName' })
  const filePath = `${date}/${agent}/${fileName}`

  const { data: log, isLoading } = useQuery({
    queryKey: ['markdown-log-by-path', filePath],
    queryFn: async () => {
      const resp = await markdownApi.list({ 
        start_date: date, 
        end_date: date, 
        agent_type: agent,
        page_size: 100 
      })
      return resp.items.find(l => l.file_path === filePath)
    },
    enabled: !!date && !!agent && !!fileName,
  })

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (log?.content) {
      await navigator.clipboard.writeText(log.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-1.5 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-6 space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-50" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-gray-50" />
        </div>
      </div>
    )
  }

  if (!log) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
          <Hash className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Log not found</h2>
        <p className="text-sm text-gray-500">No log matches {filePath}</p>
        <Link to="/logs" className="btn-primary mt-2 inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>
      </div>
    )
  }

  const name = displayName(log)
  const title = log.title || log.file_path.split('/').pop()?.replace('.md', '') || 'Untitled'
  const tags = (log.front_matter?.tags as string[] | undefined) ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/logs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      {/* Article card - thin accent, no overlapping hero */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
        <div className={clsx('h-1.5 w-full bg-gradient-to-r', gradientFor(name))} />
        <div className="px-6 pb-6 pt-6 sm:px-8 sm:pt-7">
          <div className="flex gap-4">
            <div className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm', gradientFor(name))}>
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{name}</span>
                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white">{log.agent_type}</span>
                <span className="hidden text-xs text-gray-400 sm:inline">· {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: enUS })}</span>
                <button
                  onClick={handleCopy}
                  className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 sm:inline-flex"
                >
                  {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy Markdown</>}
                </button>
              </div>
              <h1 className="mt-1.5 text-xl font-bold leading-tight tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 sm:hidden">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: enUS })}</span>
              </div>
            </div>
          </div>

          {/* Meta bar - single line, no duplicate date */}
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
            <span className="inline-flex items-center gap-1 text-gray-500">
              <CalendarDays className="h-3.5 w-3.5" /> {format(new Date(log.log_date), 'MMM dd, yyyy', { locale: enUS })}
            </span>
            <button onClick={handleCopy} className="ml-auto inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white sm:hidden">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
                  <TagIcon className="h-3 w-3 opacity-60" /> {tag}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          {log.summary && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Summary</div>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">{log.summary}</p>
            </div>
          )}

          {/* Content */}
          <div className="mt-6">
            <MarkdownViewer content={log.content || ''} />
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
            <span>Agent: {name} · {log.agent_type}</span>
            <span>{log.tokens_estimate ? `≈${log.tokens_estimate} tokens` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
