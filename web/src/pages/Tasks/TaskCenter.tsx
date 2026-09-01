import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Plus, Search, LayoutGrid, Table2, Loader2, Inbox,
  Archive, Pencil, Trash2, User, FolderKanban, X, AlertTriangle, Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import { tasksApi, agentApi, type Task } from '@/services/api'
import { ALL_STATUSES, STATUS_BAR, STATUS_COLOR, STATUS_ICON, STATUS_LABEL, isFinal, type TaskStatus } from './shared'
import { TaskFormModal } from './TaskFormModal'
import { TaskDrawer } from './TaskDrawer'

/* ─────────────── Task Card — polished ─────────────── */

function TaskCard({
  task, onOpen, onEdit, onDelete, onCloseTask, dragging, setDraggingId,
}: {
  task: Task
  onOpen: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (t: Task) => void
  onCloseTask: (t: Task) => void
  dragging: boolean
  setDraggingId: (id: string | null) => void
}) {
  const final = isFinal(task.status)
  return (
    <div
      draggable={!final}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
        setDraggingId(task.id)
      }}
      onDragEnd={() => setDraggingId(null)}
      onClick={() => onOpen(task)}
      className={clsx(
        'group relative cursor-pointer rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 transition-all',
        'hover:shadow-md hover:ring-gray-900/10 hover:-translate-y-[1px]',
        final && 'opacity-80 hover:opacity-100',
        dragging && 'opacity-40 rotate-1 shadow-lg',
      )}
    >
      {/* left accent bar */}
      <div className={clsx('absolute inset-y-3 left-0 w-1 rounded-full', STATUS_BAR[task.status])} />

      <div className="pl-2">
        <h4 className={clsx(
          'line-clamp-2 text-[14px] font-semibold leading-snug text-gray-900',
          final && 'line-through decoration-gray-300',
        )}>{task.title}</h4>

        {task.detail && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{task.detail.slice(0, 120)}…</p>
        )}

        {(task.project || (task.tags?.length ?? 0) > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {task.project && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-white">
                <FolderKanban className="h-3 w-3 opacity-70" />{task.project}
              </span>
            )}
            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">{tag}</span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[11px] text-gray-400">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
              {(task.agent_name || task.agent_id || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate max-w-[90px]">{task.agent_name || task.agent_id.slice(0, 8)}</span>
          </div>
          <span className="shrink-0 rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500 ring-1 ring-gray-100">
            {format(new Date(task.updated_at), 'MM/dd')}
          </span>
        </div>
      </div>

      {/* hover quick actions */}
      <div className="absolute right-2 top-2 hidden gap-1 rounded-full bg-white/95 p-1 shadow-md ring-1 ring-gray-200 backdrop-blur group-hover:flex">
        {!final && (
          <>
            <button
              title="Archive"
              onClick={e => { e.stopPropagation(); onCloseTask(task) }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
            <button
              title="Edit"
              onClick={e => { e.stopPropagation(); onEdit(task) }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          title="Delete"
          onClick={e => { e.stopPropagation(); onDelete(task) }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ─────────────── Kanban Column — polished ─────────────── */

function KanbanColumn({
  status, tasks, isDropTarget, onDropColumn, cardProps,
}: {
  status: TaskStatus
  tasks: Task[]
  isDropTarget: boolean
  onDropColumn: (status: TaskStatus) => void
  cardProps: {
    draggingId: string | null
    setDraggingId: (id: string | null) => void
    onOpen: (t: Task) => void
    onEdit: (t: Task) => void
    onDelete: (t: Task) => void
    onCloseTask: (t: Task) => void
  }
}) {
  const Icon = STATUS_ICON[status]
  const final = isFinal(status)

  const handleDragOver = (e: React.DragEvent) => {
    if (final) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={e => { if (!final) { e.preventDefault(); onDropColumn(status) } }}
      className={clsx(
        'flex w-[300px] shrink-0 flex-col rounded-2xl border bg-white shadow-sm transition-all',
        isDropTarget && !final ? 'border-primary-300 bg-primary-50/50 shadow-md' : 'border-gray-100',
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3.5">
        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', STATUS_COLOR[status].split(' ')[0])}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-gray-900">{STATUS_LABEL[status]}</span>
        <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-medium text-white">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="scrollbar-thin flex max-h-[calc(100vh-22rem)] min-h-[140px] flex-1 flex-col gap-3 overflow-y-auto bg-gray-50/40 p-3">
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} dragging={cardProps.draggingId === t.id}
            setDraggingId={cardProps.setDraggingId}
            onOpen={cardProps.onOpen} onEdit={cardProps.onEdit}
            onDelete={cardProps.onDelete} onCloseTask={cardProps.onCloseTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-10">
            <span className="text-sm text-gray-300">{final ? 'No archived' : 'Drop here'}</span>
            <span className="mt-1 text-xs text-gray-400">{final ? 'Completed tasks appear here' : 'Drag to move'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────── Archive Modal ─────────────── */

function CloseTaskModal({ task, status, onClose }: {
  task: Task | null
  status: TaskStatus | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => tasksApi.close(task!.id, { status: status as '完成' | '废弃', result: result.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.detail || 'Failed to archive, please try again'),
  })

  if (!task || !status) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="modal-pop relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Archive className="h-4 w-4" />
              </span>
              Archive → {STATUS_LABEL[status]}
            </h2>
          </div>
          <div className="space-y-4 px-6 py-5">
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900">{task.title}</span>
              <br />
              <span className="text-xs text-gray-500">Will be moved to final state and become read-only.</span>
            </p>
            <textarea
              value={result}
              onChange={e => setResult(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Archive conclusion / result (Markdown, optional)..."
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            {error && (
              <p className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />{error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 bg-gray-50/70 px-6 py-4">
            <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-sm shadow-sm"
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Delete Confirm Modal ─────────────── */

function DeleteTaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => tasksApi.delete(task!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); onClose() },
    onError: () => alert('Failed to delete, please try again'),
  })

  if (!task) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="modal-pop relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5">
          <div className="px-6 pb-4 pt-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">Delete this task?</h2>
            <p className="mt-1 break-all text-sm leading-relaxed text-gray-500">
              "{task.title}" will be permanently deleted.
            </p>
          </div>
          <div className="flex justify-center gap-2 bg-gray-50/70 px-6 py-4">
            <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-danger inline-flex items-center gap-1.5 px-5 py-2 text-sm"
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Main Page — beautified ─────────────── */

interface AgentOption { id: string; display_name: string }

export function TaskCenter() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'board'],
    queryFn: () => tasksApi.list({ page_size: 200 }),
    placeholderData: prev => prev,
  })
  const { data: agentsData } = useQuery({
    queryKey: ['agents-readable'],
    queryFn: () => agentApi.listReadable({ page_size: 100 }),
    staleTime: 60_000,
  })

  const allTasks = useMemo(() => data?.items ?? [], [data])
  const agents: AgentOption[] = (agentsData?.items ?? []).filter(a => a.is_active)

  const [keyword, setKeyword] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusPill, setStatusPill] = useState<TaskStatus | '全部'>('全部')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')

  const projects = useMemo(
    () => Array.from(new Set(allTasks.map(t => t.project).filter(Boolean))) as string[],
    [allTasks],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allTasks.filter(t => {
      if (agentFilter && t.agent_id !== agentFilter) return false
      if (projectFilter && t.project !== projectFilter) return false
      if (view === 'table' && statusPill !== '全部' && t.status !== statusPill) return false
      if (kw) {
        const hay = `${t.title}\n${t.detail || ''}\n${t.tags.join(',')}\n${t.result || ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    }).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
  }, [allTasks, agentFilter, projectFilter, statusPill, view, keyword])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: filtered.length }
    for (const s of ALL_STATUSES) c[s] = filtered.filter(t => t.status === s).length
    return c
  }, [filtered])

  const grouped = useMemo(() =>
    ALL_STATUSES.map(s => ({ status: s, items: filtered.filter(t => t.status === s) })),
  [filtered])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [closing, setClosing] = useState<{ task: Task; status: TaskStatus } | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)

  const openArchive = (task: Task, target?: TaskStatus) => {
    setClosing({ task, status: target && isFinal(target) ? target : '完成' })
    setDropTarget(null)
  }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks', 'board'] })
      const prev = qc.getQueryData(['tasks', 'board'])
      qc.setQueryData<{ items: Task[] }>(['tasks', 'board'], old =>
        old ? { ...old, items: old.items.map(t => t.id === id ? { ...t, status } : t) } : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['tasks', 'board'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const handleDropColumn = (target: TaskStatus) => {
    setDropTarget(null)
    const task = allTasks.find(t => t.id === draggingId)
    setDraggingId(null)
    if (!task || task.status === target) return
    if (isFinal(target)) return openArchive(task, target)
    updateStatus.mutate({ id: task.id, status: target })
  }

  const hasActiveFilter = agentFilter || projectFilter || keyword

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header — title + actions */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">Tasks</h1>
              <p className="text-sm text-gray-500">{filtered.length} total · {counts['进行中'] ?? 0} in progress</p>
            </div>
          </div>
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="btn-primary inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />New Task
          </button>
        </div>

        {/* Filters bar — single clean row */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Search title, details, tags..."
              className="w-full rounded-full border-0 bg-gray-50 py-2 pl-9 pr-8 text-sm placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-gray-900"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-white hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-gray-100 max-sm:hidden" />

          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="rounded-full border-0 bg-gray-50 px-3.5 py-2 text-sm font-medium text-gray-700 focus:bg-white focus:ring-1 focus:ring-gray-900"
          >
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>

          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="rounded-full border-0 bg-gray-50 px-3.5 py-2 text-sm font-medium text-gray-700 focus:bg-white focus:ring-1 focus:ring-gray-900"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {hasActiveFilter && (
            <button onClick={() => { setKeyword(''); setAgentFilter(''); setProjectFilter('') }} className="text-sm text-gray-500 hover:text-gray-700">
              Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-full bg-gray-100 p-1">
              {([['kanban', LayoutGrid, 'Board'], ['table', Table2, 'Table']] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                    view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status pills — segmented, light */}
        <div className="flex flex-wrap items-center gap-2">
          {(['全部', ...ALL_STATUSES] as const).map(s => {
            const active = statusPill === s
            const label = s === '全部' ? 'All' : STATUS_LABEL[s as TaskStatus]
            return (
              <button
                key={s}
                onClick={() => {
                  if (s === '全部') { setStatusPill('全部'); return }
                  setView('table')
                  setStatusPill(active ? '全部' : s as TaskStatus)
                }}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                  s === '全部'
                    ? clsx(active ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50')
                    : active
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50',
                )}
              >
                {s !== '全部' && <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_BAR[s as TaskStatus])} />}
                {label}
                <span className={clsx('rounded-full px-1.5 py-0 text-[11px]', active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
                  {counts[s]}
                </span>
              </button>
            )
          })}
          {statusPill !== '全部' && (
            <button onClick={() => setStatusPill('全部')} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50">
              <X className="h-3 w-3" />Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading tasks...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
            <Inbox className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">
              {hasActiveFilter || (view === 'table' && statusPill !== '全部') ? 'No matching tasks' : 'No tasks yet'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilter ? 'Try adjusting filters' : 'Create the first task to get started'}
            </p>
          </div>
          {hasActiveFilter ? (
            <button onClick={() => { setKeyword(''); setAgentFilter(''); setProjectFilter(''); setStatusPill('全部') }} className="btn-secondary px-5 py-2 text-sm">
              Clear Filters
            </button>
          ) : (
            <button onClick={() => { setEditing(null); setFormOpen(true) }} className="btn-primary gap-1.5 px-5 py-2 text-sm">
              <Plus className="h-4 w-4" />New Task
            </button>
          )}
        </div>
      ) : view === 'kanban' ? (
        <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-4">
          <div className="flex gap-4" onDragOver={e => e.preventDefault()}>
            {grouped.map(({ status, items }) => (
              <div
                key={status}
                onDragEnter={() => !isFinal(status) && setDropTarget(status)}
                onDragLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  if (!el.contains(e.relatedTarget as Node)) setDropTarget(prev => prev === status ? null : prev)
                }}
              >
                <KanbanColumn
                  status={status}
                  tasks={items}
                  isDropTarget={dropTarget === status}
                  onDropColumn={handleDropColumn}
                  cardProps={{
                    draggingId, setDraggingId,
                    onOpen: setDrawerTask,
                    onEdit: t => { setEditing(t); setFormOpen(true); setDrawerTask(null) },
                    onDelete: setDeleting,
                    onCloseTask: t => openArchive(t),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50/80 backdrop-blur">
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Title</th>
                  <th className="px-4 py-3.5">Agent</th>
                  <th className="px-4 py-3.5">Project / Tags</th>
                  <th className="px-4 py-3.5">Updated</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(task => {
                  const Icon = STATUS_ICON[task.status]
                  const final = isFinal(task.status)
                  return (
                    <tr key={task.id} className="group cursor-pointer transition-colors hover:bg-gray-50" onClick={() => setDrawerTask(task)}>
                      <td className="px-5 py-3">
                        <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1', STATUS_COLOR[task.status])}>
                          <Icon className="h-3 w-3" />{STATUS_LABEL[task.status]}
                        </span>
                      </td>
                      <td className="max-w-[360px] px-4 py-3">
                        <div className={clsx('truncate font-semibold text-gray-900', final && 'line-through decoration-gray-300')} title={task.title}>
                          {task.title}
                        </div>
                        {task.detail && <div className="truncate text-xs text-gray-500">{task.detail.slice(0, 80)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                            {(task.agent_name || '?').slice(0, 1).toUpperCase()}
                          </span>
                          {task.agent_name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {task.project && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-1 text-xs font-medium text-white">
                              <FolderKanban className="h-3 w-3 opacity-70" />{task.project}
                            </span>
                          )}
                          {task.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {format(new Date(task.updated_at), 'MM/dd HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                          {!final && (
                            <>
                              <select
                                value=""
                                onChange={e => {
                                  const v = e.target.value as TaskStatus
                                  if (!v) return
                                  if (isFinal(v)) openArchive(task, v)
                                  else updateStatus.mutate({ id: task.id, status: v })
                                }}
                                className="cursor-pointer rounded-full border-0 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white hover:ring-1 hover:ring-gray-200"
                              >
                                <option value="">Move ▸</option>
                                {ALL_STATUSES.filter(s => s !== task.status && !isFinal(s)).map(s => (
                                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                                ))}
                                <option value="完成">→ Done</option>
                                <option value="废弃">→ Abandoned</option>
                              </select>
                              <button title="Edit" onClick={() => { setEditing(task); setFormOpen(true) }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button title="Delete" onClick={() => setDeleting(task)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600 hover:ring-red-200">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-xs text-gray-500">
            {filtered.length} tasks
          </div>
        </div>
      )}

      {/* Modals */}
      <TaskFormModal
        open={formOpen}
        task={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSaved={() => qc.invalidateQueries({ queryKey: ['tasks'] })}
      />
      <TaskDrawer
        task={drawerTask}
        onClose={() => setDrawerTask(null)}
        onEdit={t => { setEditing(t); setFormOpen(true); setDrawerTask(null) }}
        onCloseTask={t => openArchive(t)}
        onDelete={setDeleting}
      />
      <CloseTaskModal
        task={closing?.task ?? null}
        status={closing?.status ?? null}
        onClose={() => setClosing(null)}
      />
      <DeleteTaskModal task={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}
