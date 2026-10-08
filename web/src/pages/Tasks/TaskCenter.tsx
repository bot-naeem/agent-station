import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Plus, Search, LayoutGrid, Loader2, Inbox,
  CheckCircle2, XCircle, ChevronRight,
  Archive, Pencil, Trash2, User, FolderKanban, X, AlertTriangle, Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import { tasksApi, agentApi, type Task } from '@/services/api'
import { ALL_STATUSES, ACTIVE_STATUSES, FINAL_STATUSES, STATUS_BAR, STATUS_COLOR, STATUS_ICON, STATUS_LABEL, isFinal, type TaskStatus } from './shared'
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
      draggable
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
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={e => { e.preventDefault(); onDropColumn(status) }}
      className={clsx(
        'flex w-[300px] shrink-0 flex-col rounded-2xl border bg-white shadow-sm transition-all',
        isDropTarget ? 'border-primary-300 bg-primary-50/50 shadow-md' : 'border-gray-100',
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

  // Dedicated query for archived tasks — always fresh after mutation
  const { data: archiveData } = useQuery({
    queryKey: ['tasks', 'archive'],
    queryFn: () => tasksApi.list({ page_size: 200 }),
    placeholderData: prev => prev,
  })

  const allTasks = useMemo(() => data?.items ?? [], [data])
  const agents: AgentOption[] = (agentsData?.items ?? []).filter(a => a.is_active)

  const [keyword, setKeyword] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusPill, setStatusPill] = useState<TaskStatus | '全部'>('全部')

  const projects = useMemo(
    () => Array.from(new Set(allTasks.map(t => t.project).filter(Boolean))) as string[],
    [allTasks],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allTasks.filter(t => {
      if (agentFilter && t.agent_id !== agentFilter) return false
      if (projectFilter && t.project !== projectFilter) return false
      if (kw) {
        const hay = `${t.title}\n${t.detail || ''}\n${t.tags.join(',')}\n${t.result || ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    }).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
  }, [allTasks, agentFilter, projectFilter, statusPill, keyword])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: filtered.length }
    for (const s of ALL_STATUSES) c[s] = filtered.filter(t => t.status === s).length
    return c
  }, [filtered])

  const grouped = useMemo(() =>
    ACTIVE_STATUSES.map(s => ({ status: s, items: filtered.filter(t => t.status === s) })),
  [filtered])

  const [showArchive, setShowArchive] = useState<'done' | 'abandoned' | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  
  const [deleting, setDeleting] = useState<Task | null>(null)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)

  

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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks', 'archive'] })
    },
  })

  const handleDropColumn = (target: TaskStatus) => {
    setDropTarget(null)
    const task = allTasks.find(t => t.id === draggingId)
    setDraggingId(null)
    if (!task || task.status === target) return
    // Immediate update for all statuses (including Done/Abandoned)
    updateStatus.mutate({ id: task.id, status: target })
    // If dropped to archive, auto-open that archive drawer
    if (isFinal(target)) setShowArchive(target === '完成' ? 'done' : 'abandoned')
  }

  const hasActiveFilter = agentFilter || projectFilter || keyword

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {filtered.length} tasks · {counts['进行中'] ?? 0} in progress
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true) }}
          className="btn-primary inline-flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </header>

      {/* Filter Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Search title, details, tags..."
            className="w-full rounded-lg border-0 bg-gray-50 py-2.5 pl-10 pr-10 text-sm placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-primary-500"
          />
          {keyword && (
            <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-white hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <div className="h-6 w-px bg-gray-100" />
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
            aria-label="Filter by agent"
          >
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>

          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:bg-white focus:ring-2 focus:ring-primary-500"
            aria-label="Filter by project"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilter && (
            <button onClick={() => { setKeyword(''); setAgentFilter(''); setProjectFilter('') }} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 whitespace-nowrap">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Active Status Tabs */}
      <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-2 px-1">
        {ACTIVE_STATUSES.map(s => {
          const active = statusPill === s
          return (
            <button
              key={s}
              onClick={() => setStatusPill(active ? '全部' : s)}
              className={clsx(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                active
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50',
              )}
            >
              <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_BAR[s])} />
              {STATUS_LABEL[s]}
              <span className={clsx('rounded-full px-1.5 py-0 text-[11px]', active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
                {counts[s]}
              </span>
            </button>
          )
        })}
        <button
          onClick={() => setStatusPill('全部')}
          className={clsx(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
            statusPill === '全部'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50',
          )}
        >
          All
          <span className={clsx('rounded-full px-1.5 py-0 text-[11px]', statusPill === '全部' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
            {counts['全部']}
          </span>
        </button>
      </div>

      {/* Content — full-height flex column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Kanban area — fills remaining height, horizontal scroll */}
        <div className="flex-1 min-h-0 -mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading tasks...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-gray-200 bg-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                <Inbox className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">
                  {hasActiveFilter || statusPill !== '全部' ? 'No matching tasks' : 'No tasks yet'}
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
          ) : (
            <div className="flex gap-4 min-w-max h-full items-start" onDragOver={e => e.preventDefault()}>
              {grouped.map(({ status, items }) => (
                <div
                  key={status}
                  onDragEnter={() => setDropTarget(status)}
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
                      onCloseTask: t => {
                        updateStatus.mutate({ id: t.id, status: '完成' })
                        setShowArchive('done')
                      },
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed bottom Archive Dock — always visible */}
        <div className="mx-4 mb-4 grid grid-cols-2 gap-3 px-1 shrink-0">
          {FINAL_STATUSES.map(s => {
            const Icon = STATUS_ICON[s]
            const count = archiveData?.items?.filter(t => t.status === s).length ?? 0
            const active = showArchive === (s === '完成' ? 'done' : 'abandoned')
            const isDone = s === '完成'
            return (
              <div
                key={s}
                role="button"
                tabIndex={0}
                onClick={() => setShowArchive(active ? null : isDone ? 'done' : 'abandoned')}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowArchive(active ? null : isDone ? 'done' : 'abandoned') } }}
                onDragEnter={e => { e.preventDefault(); setDropTarget(s) }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDragLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  if (!el.contains(e.relatedTarget as Node)) setDropTarget(prev => prev === s ? null : prev)
                }}
                onDrop={e => { e.preventDefault(); handleDropColumn(s) }}
                className={clsx(
                  'flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-4 py-3.5 text-sm font-medium transition-all',
                  active
                    ? clsx('border-solid text-white shadow-sm', isDone ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-500 border-gray-500')
                    : clsx(
                        'border-gray-200 bg-white/40 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-700',
                        dropTarget === s && (isDone ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-gray-400 bg-gray-100 text-gray-700'),
                      ),
                )}
              >
                <Icon className={clsx('h-5 w-5', active && 'text-white')} />
                <span className="font-medium">{STATUS_LABEL[s]}</span>
                <span className={clsx('rounded-full px-2 py-0.5 text-xs tabular-nums font-semibold', active ? 'bg-white/20 text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600')}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Archive Drawer — slides from right */}
      {showArchive && (
        <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              {showArchive === 'done' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-gray-400" />}
              <h2 className="text-base font-semibold text-gray-900">
                {showArchive === 'done' ? 'Done' : 'Abandoned'}
              </h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-600">
                {archiveData?.items?.filter(t => t.status === (showArchive === 'done' ? '完成' : '废弃')).length ?? 0}
              </span>
            </div>
            <button onClick={() => setShowArchive(null)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              const items = archiveData?.items?.filter(t => t.status === (showArchive === 'done' ? '完成' : '废弃')) ?? []
              if (items.length === 0) {
                return (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
                    <Archive className="h-8 w-8 opacity-40" />
                    <p>No tasks here yet</p>
                    <p className="text-xs">Drag a card here to {showArchive === 'done' ? 'complete' : 'abandon'} it</p>
                  </div>
                )
              }
              return (
                <div className="space-y-2">
                  {items.map(task => (
                    <div
                      key={task.id}
                      onClick={() => setDrawerTask(task)}
                      className="cursor-pointer rounded-xl border border-gray-100 bg-white p-3 transition-all hover:border-gray-200 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-semibold text-gray-900 line-through decoration-gray-300">
                            {task.title}
                          </div>
                          {task.detail && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-gray-500">{task.detail}</div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />{task.agent_name || '-'}
                            </span>
                            {task.project && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                <FolderKanban className="h-2.5 w-2.5 opacity-70" />{task.project}
                              </span>
                            )}
                            <span>· {format(new Date(task.updated_at), 'MM/dd HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}
      {showArchive && (
        <div onClick={() => setShowArchive(null)} className="fixed inset-0 z-20 bg-black/30" />
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
        onCloseTask={t => {
          updateStatus.mutate({ id: t.id, status: '完成' })
          setShowArchive('done')
        }}
        onDelete={setDeleting}
      />
      <DeleteTaskModal task={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}
