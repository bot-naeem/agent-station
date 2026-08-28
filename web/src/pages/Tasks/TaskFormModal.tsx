import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, AlertCircle, UserCheck, Tag as TagIcon, FileText, FolderKanban } from 'lucide-react'
import { clsx } from 'clsx'
import { tasksApi, agentApi, type Task, type TaskCreate } from '@/services/api'
import { ACTIVE_STATUSES, type TaskStatus } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** 传入则为编辑模式 */
  task?: Task | null
}

const EMPTY = {
  title: '',
  agent_id: '',
  status: '待办' as TaskStatus,
  tagsStr: '',
  project: '',
  detail: '',
}

export function TaskFormModal({ open, onClose, onSaved, task }: Props) {
  const isEdit = !!task
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: agentsData } = useQuery({
    queryKey: ['agents-readable'],
    queryFn: () => agentApi.listReadable({ page_size: 100 }),
    enabled: open,
    staleTime: 60_000,
  })
  const agents = (agentsData?.items || []).filter(a => a.is_active)

  useEffect(() => {
    if (!open) return
    setError('')
    if (task) {
      setForm({
        title: task.title,
        agent_id: task.agent_id,
        status: task.status,
        tagsStr: (task.tags || []).join(', '),
        project: task.project || '',
        detail: task.detail || '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, task])

  if (!open) return null

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    if (!form.title.trim()) return setError('标题不能为空')
    if (!form.agent_id) return setError('请选择指派的 Agent')

    setSaving(true)
    setError('')
    try {
      const tags = form.tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean)
      const payload: TaskCreate = {
        title: form.title.trim(),
        detail: form.detail.trim() || undefined,
        status: form.status,
        tags,
        project: form.project.trim() || undefined,
        agent_id: form.agent_id,
      }
      if (isEdit && task) {
        await tasksApi.update(task.id, payload)
      } else {
        await tasksApi.create(payload)
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="modal-pop relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? '编辑任务' : '新建任务分派'}
            </h2>
            <button onClick={onClose} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* 表单 */}
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">标题 *</label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="例如：修复支付网关超时问题"
                autoFocus
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                  <UserCheck className="h-3.5 w-3.5" /> 指派 Agent *
                </label>
                <select
                  value={form.agent_id}
                  onChange={e => set('agent_id', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">请选择</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.display_name}</option>
                  ))}
                </select>
                {agents.length === 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" /> 暂无可用 Agent，请先在 Agent 管理中创建
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">状态</label>
                <div className="flex gap-1">
                  {ACTIVE_STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className={clsx(
                        'flex-1 rounded-lg border px-1 py-1.5 text-xs font-medium transition-all',
                        form.status === s
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                  <TagIcon className="h-3.5 w-3.5" /> 标签
                </label>
                <input
                  value={form.tagsStr}
                  onChange={e => set('tagsStr', e.target.value)}
                  placeholder="逗号分隔，如: bug, 紧急"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                  <FolderKanban className="h-3.5 w-3.5" /> 项目
                </label>
                <input
                  value={form.project}
                  onChange={e => set('project', e.target.value)}
                  placeholder="如: payment-gateway"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                <FileText className="h-3.5 w-3.5" /> 详情（Markdown）
              </label>
              <textarea
                value={form.detail}
                onChange={e => set('detail', e.target.value)}
                rows={6}
                placeholder={'## 背景\n为什么做这件事\n\n## 操作步骤\n关键步骤和命令'}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* 底部 */}
          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5">
            <button onClick={onClose} className="btn-secondary px-4 py-1.5 text-sm">取消</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? '保存修改' : '创建分派'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
