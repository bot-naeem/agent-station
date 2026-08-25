import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, Bot, CheckSquare, TrendingUp } from 'lucide-react'
import { markdownApi, todoApi } from '../services/api'
import { format } from 'date-fns'
import { clsx } from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  color: string
}

function StatCard({ title, value, icon, trend, color }: StatCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {trend && <p className="mt-1 text-sm text-green-600">{trend}</p>}
        </div>
        <div className={clsx('p-3 rounded-xl', color)}>{icon}</div>
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

  const { data: todosData } = useQuery({
    queryKey: ['dashboard-todos'],
    queryFn: () => todoApi.list({ page_size: 5, status: 'pending' }),
  })

  const { data: recentLogs } = useQuery({
    queryKey: ['recent-logs'],
    queryFn: () => markdownApi.list({ page_size: 5 }),
  })

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-gray-500 mt-1">概览你的 Agent 日志、待办和 RAG 系统</p>
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
            <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>最近 7 天</option>
            <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>最近 30 天</option>
            <option value={`${format(new Date(new Date().setDate(new Date().getDate() - 90)), 'yyyy-MM-dd')},${format(new Date(), 'yyyy-MM-dd')}`}>最近 90 天</option>
          </select>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总日志数"
          value={stats?.total_logs ?? 0}
          icon={<FileText className="h-8 w-8 text-white" />}
          color="bg-primary-100"
        />
        <StatCard
          title="预估 Token"
          value={stats?.total_tokens ? stats.total_tokens.toLocaleString() : 0}
          icon={<TrendingUp className="h-8 w-8 text-white" />}
          color="bg-green-100"
        />
        <StatCard
          title="Agent 类型"
          value={Object.keys(stats?.by_agent ?? {}).length}
          icon={<Bot className="h-8 w-8 text-white" />}
          color="bg-purple-100"
        />
        <StatCard
          title="待办事项"
          value={todosData?.items.filter(t => t.status !== 'done').length ?? 0}
          icon={<CheckSquare className="h-8 w-8 text-white" />}
          color="bg-orange-100"
        />
      </div>

      {/* 快速操作 + 最近活动 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 快速操作 */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
            <div className="space-y-2">
              <a href="/logs" className="btn-secondary w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                浏览日志列表
              </a>
              <a href="/rag" className="btn-primary w-full justify-start">
                <Bot className="h-4 w-4 mr-2" />
                问答
              </a>
              <a href="/todos" className="btn-secondary w-full justify-start">
                <CheckSquare className="h-4 w-4 mr-2" />
                管理待办事项
              </a>
            </div>
          </div>

          {/* Agent 分布 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent 分布</h2>
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

        {/* 最近日志 + 待办事项 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 最近日志 */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">最近日志</h2>
              <a href="/logs" className="text-sm text-primary-600 hover:text-primary-700">查看全部</a>
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
                <div className="p-8 text-center text-gray-500">暂无日志数据</div>
              )}
            </div>
          </div>

          {/* 待办事项 */}
          <div className="card">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">待办事项</h2>
              <a href="/todos" className="text-sm text-primary-600 hover:text-primary-700">查看全部</a>
            </div>
            <div className="divide-y divide-gray-100">
              {todosData?.items.slice(0, 5).map((todo) => (
                <div key={todo.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <select
                      value={todo.status}
                      onChange={(e) => todoApi.update(todo.id, { status: e.target.value as 'pending' | 'in_progress' | 'done' })}
                      className={`w-6 h-6 appearance-none border rounded text-center text-xs ${todo.status === 'done' ? 'bg-green-100 text-green-700' : todo.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}
                    >
                      <option value="pending">○</option>
                      <option value="in_progress">◐</option>
                      <option value="done">●</option>
                    </select>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium truncate', todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900')}>
                        {todo.title}
                      </p>
                      {todo.session_id && <span className="text-xs text-gray-400">Session 关联</span>}
                    </div>
                    {todo.priority > 0 && (
                      <span className="text-xs font-medium text-red-500">P{todo.priority}</span>
                    )}
                  </div>
                </div>
              ))}
              {!todosData?.items.length && (
                <div className="p-8 text-center text-gray-500">暂无待办事项</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}