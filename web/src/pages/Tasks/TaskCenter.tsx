import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Plus, Search, LayoutGrid, Table2, Loader2, Inbox,
  Archive, Pencil, Trash2, User, FolderKanban, X, AlertTriangle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { tasksApi, agentApi, type Task } from '@/services/api'
import { ALL_STATUSES, ACTIVE_STATUSES, STATUS_BAR, STATUS_COLOR, STATUS_ICON, STATUS_LABEL, isFinal, type TaskStatus } from './shared'
import { TaskFormModal } from './TaskFormModal'
import { TaskDrawer } from './TaskDrawer'

/* ─────────────── Task Card ─────────────── */

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
        'group relative cursor-pointer rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200 transition-all',
        !final && 'hover:shadow-md hover:ring-primary-300 active:cursor-grabbing',
        final && 'opacity-75 hover:opacity-100',
        dragging && 'opacity-40 rotate-1',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className={clsx(
          'line-clamp-2 text-sm font-medium leading-snug text-gray-900',
          final && 'line-through decoration-gray-300',
        )}>{task.title}</h4>
      </div>

      {(task.project || (task.tags?.length ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {task.project && (
            <span className="inline-flex items-center gap-0.5 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] text-primary-700">
              <FolderKanban className="h-2.5 w-2.5" />{task.project}
            </span>
          )}
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{tag}</span>
          ))}
          {task.tags.length > 2 && (
            <span className="text-[11px] text-gray-400">+{task.tags.length - 2}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1 text-xs text-gray-500">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{task.agent_name || task.agent_id.slice(0, 8)}</span>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400">
          {format(new Date(task.updated_at), 'MM-dd')}
        </span>
      </div>

      {/* hover quick actions */}
      <div className="absolute right-1.5 top-1.5 hidden gap-0.5 rounded-lg bg-white/95 p-0.5 shadow-md ring-1 ring-gray-200 group-hover:flex">
        {!final ? (
          <>
            <button
              title="Archive"
              onClick={e => { e.stopPropagation(); onCloseTask(task) }}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
            <button
              title="Edit"
              onClick={e => { e.stopPropagation(); onEdit(task) }}
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        <button
          title="Delete"
          onClick={e => { e.stopPropagation(); onDelete(task) }}
          className="rounded p-1 text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ─────────────── Kanban Column ─────────────── */

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
    if (final) return // Final columns don't accept direct drop (requires archive modal)
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={e => { if (!final) { e.preventDefault(); onDropColumn(status) } }}
      className={clsx(
        'flex w-[240px] shrink-0 flex-col rounded-xl bg-gray-100/70 transition-colors',
        isDropTarget && !final && 'bg-primary-50 ring-2 ring-primary-300',
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={clsx('h-2 w-2 rounded-full', STATUS_BAR[status])} />
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">{STATUS_LABEL[status]}</span>
        <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-gray-200">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="scrollbar-thin flex max-h-[calc(100vh-22rem)] min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} dragging={cardProps.draggingId === t.id}
            setDraggingId={cardProps.setDraggingId}
            onOpen={cardProps.onOpen} onEdit={cardProps.onEdit}
            onDelete={cardProps.onDelete} onCloseTask={cardProps.onCloseTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-6">
            <span className="text-xs text-gray-300">{final ? 'No archived tasks' : 'Drag card here'}</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="modal-pop relative w-full max-w-md rounded-xl bg-white shadow-2xl">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Archive className="h-4.5 w-4.5 text-emerald-600" />
              Archive Task → {STATUS_LABEL[status]}
            </h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              <span className="font-medium text-gray-800">{task.title}</span>
              <br />
              After archiving, the task enters its final state and its status can no longer be changed.
            </p>
            <textarea
              value={result}
              onChange={e => setResult(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Enter archive conclusion / completion report (Markdown, optional)..."
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />{error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5">
            <button onClick={onClose} className="btn-secondary px-4 py-1.5 text-sm">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="modal-pop relative w-full max-w-sm rounded-xl bg-white shadow-2xl">
          <div className="space-y-3 px-5 py-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Delete this task?</h2>
            <p className="break-all text-sm text-gray-500">
              "{task.title}" will be permanently deleted and cannot be recovered.
            </p>
          </div>
          <div className="flex justify-center gap-2 border-t border-gray-100 px-5 py-3.5">
            <button onClick={onClose} className="btn-secondary px-5 py-1.5 text-sm">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-danger inline-flex items-center gap-1.5 px-5 py-1.5 text-sm"
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

/* ─────────────── Main Page ─────────────── */

interface AgentOption { id: string; display_name: string }

export function TaskCenter() {
  const qc = useQueryClient()

  // Data
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

  // Filters
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

  // Modal / drawer state
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [closing, setClosing] = useState<{ task: Task; status: TaskStatus } | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  // Drag
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)

  const openArchive = (task: Task, target?: TaskStatus) => {
    setClosing({ task, status: target && isFinal(target) ? target : '完成' })
    setDropTarget(null)
  }

  // Status change mutation (optimistic update)
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
    if (isFinal(target)) return openArchive(task, target) // Drag to final → open archive modal
    updateStatus.mutate({ id: task.id, status: target })
  }

  const hasActiveFilter = agentFilter || projectFilter || keyword

  return (
    <div className="-m-4 lg:-m-8">
      {/* ─── Header ─── */}
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-gray-50/95 px-4 pb-3 pt-5 backdrop-blur lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative mr-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Search title, details, tags, result..."
              className="w-56 rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-8 text-sm shadow-sm placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary-400 focus:outline-none"
          >
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>

          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary-400 focus:outline-none"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* View toggle */}
          <div className="ml-auto flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {([['kanban', LayoutGrid, 'Board'], ['table', Table2, 'Table']] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  view === v ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="btn-primary inline-flex items-center gap-1.5 !py-1.5 text-sm shadow-sm"
          >
            <Plus className="h-4 w-4" />New Task
          </button>
        </div>

        {/* ─── Stats Bar ─── */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
                  s === '全部'
                    ? clsx(
                        'bg-gray-900 text-white',
                        statusPill !== '全部' && 'opacity-70 hover:opacity-100',
                      )
                    : active
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-primary-300',
                )}
              >
                {s !== '全部' && <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_BAR[s as TaskStatus])} />}
                {label}
                <span className={clsx('tabular-nums', active || s === '全部' ? 'opacity-80' : 'text-gray-400')}>
                  {counts[s]}
                </span>
              </button>
            )
          })}
          {statusPill !== '全部' && (
            <button
              onClick={() => setStatusPill('全部')}
              className="ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-1 text-xs text-gray-400 hover:text-gray-700"
            >
              <X className="h-3 w-3" />Clear
            </button>
          )}
        </div>
      </div>

      {/* ─── Content ─── */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading tasks...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center gap-3">
          <Inbox className="h-12 w-12 text-gray-200" />
          <div className="text-center">
            <p className="font-medium text-gray-700">
              {hasActiveFilter || (view === 'table' && statusPill !== '全部') ? 'No matching tasks' : 'No tasks yet'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {hasActiveFilter ? 'Try adjusting filters' : 'Click "New Task" at the top right to create the first task'}
            </p>
          </div>
          {hasActiveFilter && (
            <button onClick={() => { setKeyword(''); setAgentFilter(''); setProjectFilter(''); setStatusPill('全部') }} className="btn-secondary px-4 py-1.5 text-sm">
              Clear Filters
            </button>
          )}
        </div>
      ) : view === 'kanban' ? (
        /* Kanban view */
        <div className="scrollbar-thin overflow-x-auto px-4 py-4 lg:px-8">
          <div
            className="flex gap-3"
            onDragOver={e => e.preventDefault()}
          >
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
        /* Table view */
        <div className="px-4 py-4 lg:px-8">
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Project / Tags</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(task => {
                    const Icon = STATUS_ICON[task.status]
                    const final = isFinal(task.status)
                    return (
                      <tr key={task.id} className="group cursor-pointer transition-colors hover:bg-gray-50/80" onClick={() => setDrawerTask(task)}>
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                            STATUS_COLOR[task.status],
                          )}>
                            <Icon className="h-3 w-3" />{STATUS_LABEL[task.status]}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-2.5">
                          <div className={clsx('truncate font-medium text-gray-900', final && 'line-through decoration-gray-300')} title={task.title}>
                            {task.title}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{task.agent_name || '-'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {task.project && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] text-primary-700">
                                <FolderKanban className="h-2.5 w-2.5" />{task.project}
                              </span>
                            )}
                            {task.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                          {format(new Date(task.updated_at), 'MM-dd HH:mm')}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={e => e.stopPropagation()}>
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
                                  className="cursor-pointer rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-600 hover:border-gray-300"
                                >
                                  <option value="">Move to ▸</option>
                                  {ACTIVE_STATUSES.filter(s => s !== task.status).map(s => (
                                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                                  ))}
                                  <option value="完成">Archive as Done</option>
                                  <option value="废弃">Archive as Abandoned</option>
                                </select>
                                <button title="Edit" onClick={() => { setEditing(task); setFormOpen(true) }} className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            <button title="Delete" onClick={() => setDeleting(task)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
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
            <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
              {filtered.length} tasks total
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}
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
