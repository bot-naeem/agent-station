import { Clock, CircleDot, CheckCircle2, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Task } from '@/services/api'

export type TaskStatus = Task['status']

export const ALL_STATUSES: TaskStatus[] = ['待办', '进行中', '完成', '废弃']
export const ACTIVE_STATUSES: TaskStatus[] = ['待办', '进行中']
export const FINAL_STATUSES: TaskStatus[] = ['完成', '废弃']

// Display labels in English — keys (Chinese) are kept for API compatibility
export const STATUS_LABEL: Record<TaskStatus, string> = {
  '待办': 'Todo',
  '进行中': 'In Progress',
  '完成': 'Done',
  '废弃': 'Abandoned',
}

export const STATUS_COLOR: Record<TaskStatus, string> = {
  '待办': 'bg-gray-100 text-gray-700 ring-gray-200',
  '进行中': 'bg-blue-100 text-blue-700 ring-blue-200',
  '完成': 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  '废弃': 'bg-gray-100 text-gray-400 ring-gray-200',
}

/** Kanban column header color bar */
export const STATUS_BAR: Record<TaskStatus, string> = {
  '待办': 'bg-gray-400',
  '进行中': 'bg-blue-500',
  '完成': 'bg-emerald-500',
  '废弃': 'bg-gray-300',
}

export const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  '待办': Clock,
  '进行中': CircleDot,
  '完成': CheckCircle2,
  '废弃': XCircle,
}

export function isFinal(status: TaskStatus): boolean {
  return FINAL_STATUSES.includes(status)
}
