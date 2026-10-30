import { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft, Check, Eye, FileText, Globe, Loader2, PenLine, Save, StickyNote,
  Tag as TagIcon, Trash2, Video,
} from 'lucide-react'
import { clipApi, type Clip, type ClipSourceType, type ClipStatus } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'

const SOURCE_OPTIONS: Array<{ value: ClipSourceType; label: string; icon: typeof Globe }> = [
  { value: 'web', label: 'Web', icon: Globe },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'other', label: 'Other', icon: FileText },
]

export function ClipEditor() {
  const { clipId } = useParams({ strict: false }) as { clipId?: string }
  const isNew = !clipId || clipId === 'new'
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedTick, setSavedTick] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState<ClipSourceType>('web')
  const [coverImage, setCoverImage] = useState('')
  const [category, setCategory] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [status, setStatus] = useState<ClipStatus>('published')

  useEffect(() => {
    if (isNew || !clipId) return
    setLoading(true)
    clipApi.get(clipId)
      .then((clip: Clip) => {
        setTitle(clip.title)
        setContent(clip.content || '')
        setSummary(clip.summary || '')
        setSourceUrl(clip.source_url || '')
        setSourceType(clip.source_type)
        setCoverImage(clip.cover_image || '')
        setCategory(clip.category || '')
        setTagsStr(clip.tags.join(', '))
        setStatus(clip.status)
      })
      .catch((err) => setLoadError(err.response?.data?.detail || 'Failed to load clip'))
      .finally(() => setLoading(false))
  }, [clipId, isNew])

  const touch = () => setDirty(true)

  const handleSave = async () => {
    if (saving) return
    if (!title.trim()) {
      setSaveError('Title is required')
      return
    }
    if (!content.trim()) {
      setSaveError('Content is required')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        title: title.trim(),
        content,
        summary: summary.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
        source_type: sourceType,
        cover_image: coverImage.trim() || undefined,
        category: category.trim() || undefined,
        tags: tagsStr.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        status,
      }
      if (isNew) {
        const created = await clipApi.create(payload)
        navigate({ to: '/clips/editor/$clipId', params: { clipId: created.id } as any, replace: true })
        setDirty(false)
      } else {
        await clipApi.update(clipId!, payload)
        setDirty(false)
        setSavedTick(true)
        setTimeout(() => setSavedTick(false), 2000)
      }
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || 'Failed to save clip')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const handleDelete = async () => {
    if (isNew || !clipId) return
    if (!window.confirm('Delete this clip permanently?')) return
    try {
      await clipApi.delete(clipId)
      navigate({ to: '/clips' as any })
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || 'Failed to delete clip')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading clip...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{loadError}</p>
        <button onClick={() => navigate({ to: '/clips' as any })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">Back to Clips</button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-none flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={() => navigate({ to: '/clips' as any })}
            title="Back to clips"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={title}
            onChange={(event) => { setTitle(event.target.value); touch() }}
            placeholder="Clip title"
            className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-lg font-bold text-gray-900 outline-none transition-colors placeholder-gray-300 hover:border-gray-200 focus:border-gray-300 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium',
            savedTick ? 'bg-emerald-50 text-emerald-600' : dirty ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500',
          )}>
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving...</> :
              savedTick ? <><Check className="h-3 w-3" />Saved</> :
                dirty ? 'Unsaved' : 'Saved'}
          </span>

          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value as ClipStatus); touch() }}
            className="rounded-lg border border-transparent bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-200 focus:bg-white focus:outline-none"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          {!isNew && (
            <button
              onClick={handleDelete}
              title="Delete clip"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
          {SOURCE_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                onClick={() => { setSourceType(option.value); touch() }}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                  sourceType === option.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {option.label}
              </button>
            )
          })}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={sourceUrl}
            onChange={(event) => { setSourceUrl(event.target.value); touch() }}
            placeholder="Source URL (article / video link)"
            className="w-full rounded-lg border border-transparent bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-gray-700 outline-none placeholder-gray-400 hover:border-gray-200 focus:border-gray-300 focus:bg-white"
          />
        </div>

        <div className="relative min-w-[160px]">
          <TagIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={category}
            onChange={(event) => { setCategory(event.target.value); touch() }}
            placeholder="Category"
            className="w-full rounded-lg border border-transparent bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-gray-700 outline-none placeholder-gray-400 hover:border-gray-200 focus:border-gray-300 focus:bg-white"
          />
        </div>

        <input
          value={tagsStr}
          onChange={(event) => { setTagsStr(event.target.value); touch() }}
          placeholder="Tags, comma separated"
          className="min-w-[180px] rounded-lg border border-transparent bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none placeholder-gray-400 hover:border-gray-200 focus:border-gray-300 focus:bg-white"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <input
          value={summary}
          onChange={(event) => { setSummary(event.target.value); touch() }}
          placeholder="Summary (optional, shown on list page)"
          className="min-w-[240px] flex-1 rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none placeholder-gray-400 hover:border-gray-200 focus:border-gray-300 focus:bg-white"
        />
        <input
          value={coverImage}
          onChange={(event) => { setCoverImage(event.target.value); touch() }}
          placeholder="Cover image URL (optional)"
          className="min-w-[240px] flex-1 rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none placeholder-gray-400 hover:border-gray-200 focus:border-gray-300 focus:bg-white"
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-0.5 self-start rounded-lg bg-gray-100 p-0.5 lg:hidden">
          {([['write', 'Edit', PenLine], ['preview', 'Preview', Eye]] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setMobileTab(value)}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                mobileTab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400 tabular-nums">{content.length} chars · Ctrl/Cmd+S to save</span>
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:grid-cols-2 lg:divide-x lg:divide-gray-200">
        <div className={clsx('min-h-0 min-w-0', mobileTab === 'write' ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            <PenLine className="h-3 w-3" /> Clip Content
          </div>
          <textarea
            value={content}
            onChange={(event) => { setContent(event.target.value); touch(); setMobileTab('write') }}
            spellCheck={false}
            placeholder="Paste the clipped article, notes, or video transcript here (Markdown)..."
            className="h-[calc(100%-2rem)] w-full resize-none px-5 py-4 font-mono text-[13.5px] leading-relaxed text-gray-800 outline-none scrollbar-thin"
          />
        </div>

        <div className={clsx('min-h-0 min-w-0 bg-white', mobileTab === 'preview' ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            <Eye className="h-3 w-3" /> Live Preview
          </div>
          <div className="h-[calc(100%-2rem)] overflow-auto px-6 py-4 scrollbar-thin">
            {content.trim()
              ? <MarkdownViewer content={content} />
              : <p className="text-sm text-gray-300">Content will render here as you type.</p>}
          </div>
        </div>
      </div>

      {saveError && <div className="pt-2 text-xs text-red-600">{saveError}</div>}
    </div>
  )
}
