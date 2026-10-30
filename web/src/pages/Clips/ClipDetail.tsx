import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, Calendar, Clock, ExternalLink, FileText, Globe, Loader2, Pencil,
  StickyNote, Trash2, Video,
} from 'lucide-react'
import { clipApi, type Clip } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'

const SOURCE_META: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  web: { label: 'Web', icon: Globe, className: 'bg-sky-50 text-sky-700 ring-sky-100' },
  video: { label: 'Video', icon: Video, className: 'bg-rose-50 text-rose-700 ring-rose-100' },
  note: { label: 'Note', icon: StickyNote, className: 'bg-amber-50 text-amber-700 ring-amber-100' },
  other: { label: 'Other', icon: FileText, className: 'bg-gray-50 text-gray-600 ring-gray-200' },
}

export function ClipDetail() {
  const { clipId } = useParams({ strict: false }) as { clipId: string }
  const navigate = useNavigate()
  const [clip, setClip] = useState<Clip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!clipId) return
    setLoading(true)
    clipApi.get(clipId)
      .then(setClip)
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load clip'))
      .finally(() => setLoading(false))
  }, [clipId])

  const handleDelete = async () => {
    if (!clip || deleting) return
    if (!window.confirm('Delete this clip permanently?')) return
    setDeleting(true)
    try {
      await clipApi.delete(clip.id)
      navigate({ to: '/clips' as any })
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete clip')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading clip...
      </div>
    )
  }

  if (error || !clip) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{error || 'Clip not found'}</p>
        <Link to="/clips" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">Back to Clips</Link>
      </div>
    )
  }

  const source = SOURCE_META[clip.source_type] || SOURCE_META.other
  const SourceIcon = source.icon
  const updated = new Date(clip.updated_at).getTime() - new Date(clip.created_at).getTime() > 60_000

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/clips" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Back to Clips
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/clips/editor/$clipId"
            params={{ clipId: clip.id } as any}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
          </button>
        </div>
      </div>

      <article className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <header className="border-b border-gray-50 p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1', source.className)}>
              <SourceIcon className="h-3.5 w-3.5" /> {source.label}
            </span>
            {clip.category && (
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-100">{clip.category}</span>
            )}
            <span className={clsx(
              'rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1',
              clip.status === 'published' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
              clip.status === 'archived' ? 'bg-gray-100 text-gray-600 ring-gray-200' :
              'bg-amber-50 text-amber-700 ring-amber-100',
            )}>
              {clip.status}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{clip.title}</h1>
          {clip.summary && <p className="mt-3 border-l-2 border-gray-200 pl-4 text-base leading-7 text-gray-600">{clip.summary}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{clip.agent_name || 'Admin'}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(clip.created_at), 'yyyy-MM-dd HH:mm')}</span>
            {updated && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> edited {formatDistanceToNow(new Date(clip.updated_at), { addSuffix: true })}</span>
            )}
            {clip.source_url && (
              <a href={clip.source_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sky-600 hover:text-sky-700">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{clip.source_url}</span>
              </a>
            )}
          </div>

          {clip.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {clip.tags.map((tag) => (
                <Link
                  key={tag}
                  to="/clips"
                  search={{ tag } as any}
                  className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {clip.cover_image && (
          <div className="px-6 pt-6 sm:px-8">
            <img src={clip.cover_image} alt={clip.title} className="max-h-[420px] w-full rounded-xl object-cover ring-1 ring-gray-100" />
          </div>
        )}

        <div className="p-6 sm:p-8">
          <MarkdownViewer content={clip.content || ''} />
        </div>
      </article>
    </div>
  )
}
