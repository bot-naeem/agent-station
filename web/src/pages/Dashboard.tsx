import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, Bot, KanbanSquare, TrendingUp, User, LayoutDashboard, ArrowRight, Activity } from 'lucide-react'
import { markdownApi, tasksApi } from '../services/api'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { clsx } from 'clsx'
import { STATUS_COLOR, STATUS_ICON } from './Tasks/shared'

const STATUS_LABEL: Record<string, string> = {
  '待办': 'Todo',
  '进行中': 'In Progress',
  '完成': 'Done',
  '废弃': 'Discarded',
}

function StatCard({ title, value, icon, accent }: { title: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px]">
      <div className={clsx('absolute inset-x-0 top-0 h-1', accent)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-700 ring-1 ring-gray-100">{icon}</div>
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
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Overview of your agent fleet</p>
          </div>
        </div>
        <select
          value={`${format(dateRange.start, 'yyyy-MM-dd')},${format(dateRange.end, 'yyyy-MM-dd')}`}
          onChange={(e) => {
            const [start, end] = e.target.value.split(',')
            setDateRange({ start: new Date(start), end: new Date(end) })
          }}
          className="rounded-full border-0 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 focus:ring-1 focus:ring-gray-900"
        >
          <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>Last 7 days</option>
          <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>Last 30 days</option>
          <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 90)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>Last 90 days</option>
        </select>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Logs" value={stats?.total_logs ?? 0} icon={<FileText className="h-5 w-5" />} accent="bg-gradient-to-r from-violet-500 to-indigo-500" />
        <StatCard title="Est. Tokens" value={stats?.total_tokens ? `${(stats.total_tokens/1000).toFixed(1)}k` : '0'} icon={<TrendingUp className="h-5 w-5" />} accent="bg-gradient-to-r from-blue-500 to-cyan-500" />
        <StatCard title="Agent Types" value={Object.keys(stats?.by_agent ?? {}).length} icon={<Bot className="h-5 w-5" />} accent="bg-gradient-to-r from-emerald-500 to-teal-500" />
        <StatCard title="Active Tasks" value={totalActive} icon={<KanbanSquare className="h-5 w-5" />} accent="bg-gradient-to-r from-amber-500 to-orange-500" />
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: quick actions + distribution */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Activity className="h-4 w-4 text-gray-400" /> Quick Actions
            </h2>
            <div className="mt-4 grid gap-2">
              <a href="/app/logs" className="group flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-gray-500" />Browse Logs</span>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
              </a>
              <a href="/app/tasks" className="group flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm">
                <span className="flex items-center gap-2"><KanbanSquare className="h-4 w-4 text-gray-500" />Go to Tasks</span>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Agent Distribution</h2>
            <div className="mt-4 space-y-4">
              {Object.entries(stats?.by_agent ?? {}).map(([agent, count]) => (
                <div key={agent} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                    {agent.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-700 capitalize truncate">{agent}</span>
                  <div className="flex items-center gap-2">
                    <div className="hidden w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden sm:block">
                      <div className="h-full bg-gray-900 rounded-full" style={{ width: `${(count / (stats?.total_logs || 1)) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {!Object.keys(stats?.by_agent ?? {}).length && (
                <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: recent logs + tasks */}
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-gray-900">Recent Logs</h2>
              <a href="/app/logs" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">View All <ArrowRight className="h-3 w-3" /></a>
            </div>
            <div className="divide-y divide-gray-50">
              {recentLogs?.items.slice(0, 5).map((log) => (
                <a key={log.id} href={`/app/logs/${log.log_date}/${log.agent_type}/${log.file_path.split('/').pop()}`} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50">
                  <span className="hidden h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-xs font-medium text-white sm:flex">
                    {log.agent_type.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 group-hover:text-gray-700">
                      {log.title || log.file_path.split('/').pop()?.replace('.md', '')}
                    </p>
                    <p className="text-xs text-gray-500">{format(new Date(log.log_date), 'MMM dd, yyyy', { locale: enUS })}</p>
                  </div>
                  <span className="hidden shrink-0 rounded-full bg-gray-50 px-2 py-1 text-xs text-gray-500 ring-1 ring-gray-100 sm:inline">
                    {log.tokens_estimate ? `${(log.tokens_estimate / 1000).toFixed(1)}k` : ''}
                  </span>
                </a>
              ))}
              {!recentLogs?.items.length && <div className="p-10 text-center text-sm text-gray-400">No logs yet</div>}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-gray-900">Active Tasks</h2>
              <a href="/app/tasks" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">View Tasks <ArrowRight className="h-3 w-3" /></a>
            </div>
            <div className="divide-y divide-gray-50">
              {activeTasks.slice(0, 5).map((task) => {
                const Icon = STATUS_ICON[task.status]
                return (
                  <a key={task.id} href="/app/tasks" className="group flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1', STATUS_COLOR[task.status])}>
                      <Icon className="h-3 w-3" />{STATUS_LABEL[task.status] ?? task.status}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{task.title}</p>
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-gray-500 sm:inline-flex">
                      <User className="h-3 w-3" />{task.agent_name || '-'}
                    </span>
                  </a>
                )
              })}
              {!activeTasks.length && <div className="p-10 text-center text-sm text-gray-400">No active tasks</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
