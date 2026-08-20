import { clsx } from 'clsx'
import { GripVertical, MoreHorizontal, Trash2, Edit2 } from 'lucide-react'
import { useState } from 'react'
import type { Todo } from '../services/api'

interface TodoItemProps {
  todo: Todo
  onUpdate: (id: string, data: Partial<Todo>) => void
  onDelete: (id: string) => void
  isDragging?: boolean
}

export function TodoItem({ todo, onUpdate, onDelete, isDragging }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [showMenu, setShowMenu] = useState(false)

  const statusColors: Record<string, string> = {
    pending: 'badge-gray',
    in_progress: 'badge-warning',
    done: 'badge-success',
  }

  const priorityColors: Record<number, string> = {
    0: 'text-gray-400',
    1: 'text-gray-400',
    2: 'text-gray-400',
    3: 'text-blue-500',
    4: 'text-blue-500',
    5: 'text-yellow-500',
    6: 'text-yellow-500',
    7: 'text-orange-500',
    8: 'text-orange-500',
    9: 'text-red-500',
    10: 'text-red-500',
  }

  const handleStatusChange = (status: Todo['status']) => {
    onUpdate(todo.id, { status })
  }

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle !== todo.title) {
      onUpdate(todo.id, { title: editTitle.trim() })
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit()
    if (e.key === 'Escape') {
      setEditTitle(todo.title)
      setEditing(false)
    }
  }

  return (
    <div
      className={clsx(
        'group relative bg-white rounded-lg border border-gray-200 p-4 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'opacity-50 rotate-2 shadow-lg',
        todo.status === 'done' && 'opacity-75 bg-green-50'
      )}
      draggable={!editing}
    >
      {/* 拖拽手柄 */}
      <button
        className="absolute -left-8 top-4 text-gray-300 hover:text-gray-500 hidden group-hover:block"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex gap-3">
        {/* 状态选择 */}
        <select
          value={todo.status}
          onChange={(e) => handleStatusChange(e.target.value as Todo['status'])}
          className={clsx(
            'w-8 h-8 appearance-none border rounded-lg text-center text-sm font-medium cursor-pointer',
            statusColors[todo.status]
          )}
        >
          <option value="pending">○</option>
          <option value="in_progress">◐</option>
          <option value="done">●</option>
        </select>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full px-2 py-1 text-sm border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <div className="flex items-start gap-2">
              <h3
                className={clsx(
                  'font-medium text-sm break-all',
                  todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'
                )}
              >
                {todo.title}
              </h3>
              {todo.priority > 0 && (
                <span className={clsx('text-xs font-medium', priorityColors[todo.priority])}>
                  P{todo.priority}
                </span>
              )}
            </div>
          )}

          {todo.description && (
            <p className={clsx('mt-1 text-xs line-clamp-2', todo.status === 'done' ? 'text-gray-400' : 'text-gray-500')}>
              {todo.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
            <span>{new Date(todo.created_at).toLocaleDateString()}</span>
            {todo.session_id && (
              <span className="badge badge-gray">Session</span>
            )}
          </div>
        </div>

        {/* 菜单 */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
              <button
                onClick={() => { setEditing(true); setShowMenu(false) }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit2 className="h-4 w-4" />
                编辑
              </button>
              <button
                onClick={() => { onDelete(todo.id); setShowMenu(false) }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}