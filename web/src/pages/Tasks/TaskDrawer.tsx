import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { X, Pencil, Archive, Trash2, User, FolderKanban, Tag as TagIcon, CalendarClock, ArrowRight, FileCheck2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Task } from '@/services/api'
import { MarkdownViewer } from '@/components/MarkdownViewer'
import { STATUS_COLOR, STATUS_ICON, isFinal, type TaskStatus } from './shared'

interface Props {
  task: Task | null
  onClose: () => void
  onEdit: (task: Task) => void
  onCloseTask: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskDrawer({ task, onClose, onEdit, onCloseTask, onDelete }: Props) {
  if (!task) return null

  const StatusIcon = STATUS_ICON[task.status]
  const final = isFinal(task.status)

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="drawer-in scrollbar-thin absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1',
                STATUS_COLOR[task.status],
              )}>
                <StatusIcon className="h-3 w-3" />
                {task.status}
              </span>
              {task.project && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                  <FolderKanban className="h-3 w-3" />{task.project}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold leading-snug text-gray-900">{task.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 正文 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 元信息 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <User className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">执行 Agent：{task.agent_name || task.agent_id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" />
              更新于 {format(new Date(task.updated_at), 'MM-dd HH:mm', { locale: zhCN })}
            </div>
            {(task.tags?.length ?? 0) > 0 && (
              <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                <TagIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {task.tags.map(tag => (
                  <span key={tag} className="rounded bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 详情 */}
          {task.detail && (
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">任务详情</h3>
              <MarkdownViewer content={task.detail} />
            </section>
          )}

          {/* 完成结论 */}
          {final && task.result && (
            <section className="mt-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                <FileCheck2 className="h-4 w-4" /> 归档结论
              </h3>
              <div className="rounded-xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
                <MarkdownViewer content={task.result} />
              </div>
            </section>
          )}

          {/* 状态历史时间线 */}
          {task.status_history?.length > 0 && (
            <section className="mt-5 pb-2">
              <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">状态流转</h3>
              <ol className="relative space-y-3 border-l border-gray-200 pl-5">
                {[...task.status_history].reverse().map((h, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-primary-400 ring-4 ring-primary-50" />
                    <span className="inline-flex items-center gap-1.5 text-gray-800">
                      {h.from ? (
                        <>
                          <span>{h.from}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                        </>
                      ) : (
                        <span>创建为</span>
                      )}
                      <span className="font-medium">{h.to}</span>
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {format(new Date(h.at), 'MM-dd HH:mm', { locale: zhCN })}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3.5">
          {!final && (
            <>
              <button
                onClick={() => onDelete(task)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> 删除
              </button>
              <button
                onClick={() => onCloseTask(task)}
                className="btn-secondary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm"
              >
                <Archive className="h-4 w-4" /> 归档
              </button>
              <button
                onClick={() => onEdit(task)}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm"
              >
                <Pencil className="h-4 w-4" /> 编辑
              </button>
            </>
          )}
          {final && (
            <button
              onClick={() => onDelete(task)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> 删除记录
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}
