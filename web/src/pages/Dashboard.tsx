import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, Bot, KanbanSquare, TrendingUp, User } from 'lucide-react'
import { markdownApi, tasksApi } from '../services/api'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { clsx } from 'clsx'
import { STATUS_COLOR, STATUS_ICON } from './Tasks/shared'

const STATUS_LABEL: Record<string, string> = {
  '待办': 'Todo',
  '进行中': 'In Progress',
  '阻塞': 'Blocked',
  '挂起': 'Pending',
  '完成': 'Done',
  '废弃': 'Discarded',
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
}

function StatCard({ title, value, icon, trend }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
          {trend && <p className="mt-1 text-xs text-gray-500">{trend}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-600 ring-1 ring-gray-100">{icon}</div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', dateRange],
    queryFn: () => markdownApi.stats(
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd')
    ),
  })

  const { data: tasksData } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => tasksApi.list({ page_size: 5 }),
  })

  const activeTasks = tasksData?.items.filter(t => !['完成', '废弃'].includes(t.status)) ?? []
  const totalActive = (tasksData?.total ?? 0) - (tasksData?.items.filter(t => ['完成', '废弃'].includes(t.status)).length ?? 0)

  const { data: recentLogs } = useQuery({
    queryKey: ['recent-logs'],
    queryFn: () => markdownApi.list({ page_size: 5 }),
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your Agent logs and tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={`${format(dateRange.start, 'yyyy-MM-dd')},${format(dateRange.end, 'yyyy-MM-dd')}`}
            onChange={(e) => {
              const [start, end] = e.target.value.split(',')
              setDateRange({ start: new Date(start), end: new Date(end) })
            }}
            className="input w-auto"
          >
            <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>Last 7 days</option>
            <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>Last 30 days</option>
            <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 90)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Logs" value={stats?.total_logs ?? 0} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Est. Tokens" value={stats?.total_tokens ? stats.total_tokens.toLocaleString() : 0} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Agent Types" value={Object.keys(stats?.by_agent ?? {}).length} icon={<Bot className="h-5 w-5" />} />
        <StatCard title="Active Tasks" value={totalActive} icon={<KanbanSquare className="h-5 w-5" />} />
      </div>

      {/* Quick actions + Recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <a href="/logs" className="btn-secondary w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Browse Logs
              </a>
              <a href="/tasks" className="btn-secondary w-full justify-start">
                <KanbanSquare className="h-4 w-4 mr-2" />
                Go to Tasks
              </a>
            </div>
          </div>

          {/* Agent Distribution */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Distribution</h2>
            <div className="space-y-3">
              {Object.entries(stats?.by_agent ?? {}).map(([agent, count]) => (
                <div key={agent} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">{agent}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full"
                        style={{ width: `${(count / (stats?.total_logs || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-10 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent logs + Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent logs */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Logs</h2>
              <a href="/logs" className="text-sm text-primary-600 hover:text-primary-700">View All</a>
            </div>
            <div className="divide-y divide-gray-100">
              {recentLogs?.items.slice(0, 5).map((log) => (
                <a
                  key={log.id}
                  href={`/logs/${log.log_date}/${log.agent_type}/${log.file_path.split('/').pop()}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="badge badge-primary">{log.agent_type}</span>
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-md">
                          {log.title || log.file_path.split('/').pop()?.replace('.md', '')}
                        </p>
                        <p className="text-sm text-gray-500">{format(new Date(log.log_date), 'yyyy-MM-dd')}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      {log.tokens_estimate ? `${(log.tokens_estimate / 1000).toFixed(1)}k tokens` : ''}
                    </span>
                  </div>
                </a>
              ))}
              {!recentLogs?.items.length && (
                <div className="p-8 text-center text-gray-500">No logs yet</div>
              )}
            </div>
          </div>

          {/* Task center */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
              <a href="/tasks" className="text-sm text-primary-600 hover:text-primary-700">View Tasks</a>
            </div>
            <div className="divide-y divide-gray-100">
              {activeTasks.slice(0, 5).map((task) => {
                const Icon = STATUS_ICON[task.status]
                return (
                  <a key={task.id} href="/tasks" className="block p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                        STATUS_COLOR[task.status],
                      )}>
                        <Icon className="h-3 w-3" />{STATUS_LABEL[task.status] ?? task.status}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{task.title}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                        <User className="h-3 w-3" />
                        {task.agent_name || '-'}
                        <span className="ml-1 hidden sm:inline">
                          {format(new Date(task.updated_at), 'MM-dd HH:mm', { locale: enUS })}
                        </span>
                      </span>
                    </div>
                  </a>
                )
              })}
              {!activeTasks.length && (
                <div className="p-8 text-center text-gray-500">No active tasks, create one in Task Center</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
