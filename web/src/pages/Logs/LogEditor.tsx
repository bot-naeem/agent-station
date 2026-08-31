import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Save, Loader2, Check, Tag as TagIcon, FileText, Eye, PenLine } from 'lucide-react'
import { format } from 'date-fns'
import { markdownApi, type MarkdownLog } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'

export function LogEditor() {
  const { logId } = useParams({ strict: false }) as { logId: string }
  const navigate = useNavigate()

  const [log, setLog] = useState<MarkdownLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [title, setTitle] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [content, setContent] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedTick, setSavedTick] = useState(false)

  const [dirty, setDirty] = useState(false)
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* Load log */
  useEffect(() => {
    if (!logId) return
    setLoading(true)
    markdownApi.get(logId)
      .then(data => {
        setLog(data)
        setTitle(data.title || '')
        setTagsStr(((data.front_matter?.tags as string[]) || []).join(', '))
        setContent(data.content ?? '')
      })
      .catch(e => setLoadError(e.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [logId])

  /* Ctrl/Cmd + S to save */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const touch = () => setDirty(true)

  const handleSave = async () => {
    if (!log || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const tags = tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean)
      await markdownApi.update(log.id, {
        title: title.trim() || undefined,
        content,
        tags,
      })
      setDirty(false)
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 2000)
      queryClientInvalidate()
    } catch (e: any) {
      setSaveError(e.response?.data?.detail || 'Failed to save, please try again')
    } finally {
      setSaving(false)
    }
  }

  const queryClientInvalidate = () => {
    // Avoid circular dependency; refresh list via global cache namespace
    try {
      // tanstack query v5: trigger list to refetch via event
      window.dispatchEvent(new CustomEvent('alp:invalidate-logs'))
    } catch { /* ignore */ }
  }

  const handleBack = () => {
    navigate({ to: '/logs' })
  }

  const agentName = log?.agent_name || log?.agent_type || ''
  const words = content.length

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading log...</span>
      </div>
    )
  }

  if (loadError || !log) {
    return (
      <div className="flex h-[calc(100vh-10rem)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{loadError || 'Log not found'}</p>
        <button onClick={handleBack} className="btn-secondary">Back to list</button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-none flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={handleBack}
            title="Back to list"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); touch() }}
            placeholder="Log title"
            className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-lg font-bold text-gray-900 transition-colors placeholder-gray-300 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <TagIcon className="h-3.5 w-3.5 text-gray-400" />
            <input
              value={tagsStr}
              onChange={e => { setTagsStr(e.target.value); touch() }}
              placeholder="Tags, comma-separated"
              className="w-44 rounded-lg border border-transparent bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 transition-colors placeholder-gray-400 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none"
            />
          </div>
          <span className={clsx(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium',
            savedTick ? 'bg-emerald-50 text-emerald-600' : dirty ? 'bg-amber-50 text-amber-600' : 'text-gray-300',
          )}>
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Saving...</>
            ) : savedTick ? (
              <><Check className="h-3 w-3" />Saved</>
            ) : dirty ? (
              <>Unsaved</>
            ) : (
              <Check className="h-3 w-3 opacity-40" />
            )}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 pb-2 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1 font-medium text-gray-500">
          <FileText className="h-3 w-3" />
          {agentName}
        </span>
        <span>{fmtDate(log.log_date)} {fmtTime(log.created_at)}</span>
        <span className="font-mono">{log.file_path}</span>
        <span className="ml-auto tabular-nums">{words} characters · ≈{Math.ceil(words / 4)} tokens · ⌘S to save</span>
      </div>

      {/* Mobile tab switch */}
      <div className="mt-2 flex items-center gap-0.5 self-start rounded-lg bg-gray-100 p-0.5 lg:hidden">
        {([['write', 'Edit', PenLine], ['preview', 'Preview', Eye]] as const).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setMobileTab(v)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              mobileTab === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Split view */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:grid-cols-2 lg:divide-x lg:divide-gray-200">
        {/* Left: source */}
        <div className={clsx('min-h-0 min-w-0', mobileTab === 'write' ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            <PenLine className="h-3 w-3" />
            Markdown Source
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); touch(); setMobileTab('write') }}
            spellCheck={false}
            placeholder="# Write log in Markdown..."
            className="h-[calc(100%-2rem)] w-full resize-none px-5 py-4 font-mono text-[13.5px] leading-relaxed text-gray-800 focus:outline-none scrollbar-thin"
          />
        </div>

        {/* Right: live preview */}
        <div className={clsx('min-h-0 min-w-0 bg-white', mobileTab === 'preview' ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            <Eye className="h-3 w-3" />
            Live Preview
          </div>
          <div className="h-[calc(100%-2rem)] overflow-auto px-6 py-4 scrollbar-thin">
            {content.trim()
              ? <MarkdownViewer content={content} />
              : <p className="text-sm text-gray-300">Content will be rendered here after you type on the left</p>}
          </div>
        </div>
      </div>

      {/* Error footer */}
      {saveError && (
        <div className="pt-2 text-xs text-red-600">{saveError}</div>
      )}
    </div>
  )
}

function fmtDate(d: string) {
  try { return format(new Date(d), 'yyyy-MM-dd') } catch { return d }
}

function fmtTime(iso: string) {
  try { return format(new Date(iso), 'HH:mm:ss') } catch { return '' }
}
