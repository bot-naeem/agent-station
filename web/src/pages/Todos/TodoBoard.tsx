import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Filter, Search, Calendar, Hash, MoreVertical, Trash2, Edit2, GripVertical, X } from 'lucide-react'
import { format } from 'date-fns'
import { todoApi, type Todo, type TodoListParams } from '../../services/api'
import { TodoItem } from '../../components/TodoItem'
import { clsx } from 'clsx'

const COLUMNS = [
  { id: 'pending', title: '待办', color: 'bg-gray-100' },
  { id: 'in_progress', title: '进行中', color: 'bg-yellow-100' },
  { id: 'done', title: '已完成', color: 'bg-green-100' },
] as const

export function TodoBoard() {
  const [listParams, setListParams] = useState<TodoListParams>({ page_size: 200 })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTodo, setNewTodo] = useState({ title: '', description: '', priority: 0, session_id: '' })
  const queryClient = useQueryClient()

  const { data: todosData, isLoading } = useQuery({
    queryKey: ['todos', listParams],
    queryFn: () => todoApi.list(listParams),
    placeholderData: (previous) => previous,
  })

  const createMutation = useMutation({
    mutationFn: todoApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      setShowCreateModal(false)
      setNewTodo({ title: '', description: '', priority: 0, session_id: '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> }) => todoApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: todoApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const todos = todosData?.items || []
  const groupedTodos = COLUMNS.map(col => ({
    ...col,
    items: todos.filter(t => t.status === col.id).sort((a, b) => b.priority - a.priority),
  }))

  const handleStatusChange = (id: string, status: Todo['status']) => {
    updateMutation.mutate({ id, data: { status } })
  }

  const handlePriorityChange = (id: string, priority: number) => {
    updateMutation.mutate({ id, data: { priority } })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.title.trim()) return
    createMutation.mutate({
      title: newTodo.title.trim(),
      description: newTodo.description.trim() || undefined,
      priority: newTodo.priority,
      session_id: newTodo.session_id || undefined,
    })
  }

  const handleDragStart = (e: React.DragEvent, todo: Todo) => {
    e.dataTransfer.setData('application/json', JSON.stringify(todo))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, status: Todo['status']) => {
    e.preventDefault()
    try {
      const todo = JSON.parse(e.dataTransfer.getData('application/json')) as Todo
      if (todo.status !== status) {
        handleStatusChange(todo.id, status)
      }
    } catch {}
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">待办事项看板</h1>
          <p className="text-gray-500 mt-1">拖拽管理任务，跨会话关联进度</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            新建待办
          </button>
        </div>
      </div>

      {/* 看板 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 min-h-[500px]">
        {groupedTodos.map((column) => (
          <div
            key={column.id}
            className={clsx('rounded-xl', column.color, 'p-3 min-h-[400px]')}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id as Todo['status'])}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {column.title}
                <span className="text-sm font-normal text-gray-500">
                  {column.items.length}
                </span>
              </h3>
            </div>
            <div className="space-y-3 min-h-[300px]" role="list" aria-label={`${column.title} 列表`}>
              {column.items.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                  onDelete={deleteMutation.mutate}
                />
              ))}
              {column.items.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                  暂无任务
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 列表视图切换 */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">列表视图</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm font-medium text-gray-500 border-b border-gray-200">
                <th className="p-3">状态</th>
                <th className="p-3">标题</th>
                <th className="p-3">优先级</th>
                <th className="p-3">关联会话</th>
                <th className="p-3">创建时间</th>
                <th className="p-3 w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {todos.map((todo) => (
                <tr key={todo.id} className={clsx(todo.status === 'done' && 'bg-green-50')}>
                  <td className="p-3">
                    <select
                      value={todo.status}
                      onChange={(e) => handleStatusChange(todo.id, e.target.value as Todo['status'])}
                      className={clsx(
                        'w-20 appearance-none border rounded text-center text-xs',
                        todo.status === 'done' && 'bg-green-100 text-green-700',
                        todo.status === 'in_progress' && 'bg-yellow-100 text-yellow-700',
                        todo.status === 'pending' && 'bg-gray-100 text-gray-700'
                      )}
                    >
                      <option value="pending">待办</option>
                      <option value="in_progress">进行中</option>
                      <option value="done">已完成</option>
                    </select>
                  </td>
                  <td className="p-3 font-medium text-gray-900 truncate max-w-xs" title={todo.title}>
                    {todo.title}
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={todo.priority}
                      onChange={(e) => handlePriorityChange(todo.id, parseInt(e.target.value))}
                      className="w-16 input text-center"
                    />
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {todo.session_id ? (
                      <span className="font-mono text-xs">{todo.session_id.slice(0, 8)}...</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {format(new Date(todo.created_at), 'MM-dd HH:mm')}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => deleteMutation.mutate(todo.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {todos.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">暂无待办事项</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新建模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowCreateModal(false)}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">新建待办事项</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
                  <input
                    type="text"
                    value={newTodo.title}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, title: e.target.value }))}
                    className="input"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={newTodo.description}
                    onChange={(e) => setNewTodo(prev => ({ ...prev, description: e.target.value }))}
                    className="input"
                    rows={3}
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">优先级 (0-10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={newTodo.priority}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">关联 Session ID (可选)</label>
                    <input
                      type="text"
                      value={newTodo.session_id}
                      onChange={(e) => setNewTodo(prev => ({ ...prev, session_id: e.target.value }))}
                      className="input"
                      placeholder="自动关联或手动输入"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
                    取消
                  </button>
                  <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                    {createMutation.isPending ? '创建中...' : '创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}