import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Hash, Bot, FileText, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { markdownApi, type MarkdownLog } from '../../services/api'
import { clsx } from 'clsx'

export function Timeline() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  })
  const [groupBy, setGroupBy] = useState<'date' | 'agent' | 'project'>('date')

  const { data: logsData } = useQuery({
    queryKey: ['timeline-logs', dateRange],
    queryFn: () => markdownApi.list({
      start_date: format(dateRange.start, 'yyyy-MM-dd'),
      end_date: format(dateRange.end, 'yyyy-MM-dd'),
      page_size: 500,
    }),
  })

  const logs = logsData?.items || []

  // 按日期分组
  const groupedByDate = logs.reduce((acc, log) => {
    const date = log.log_date
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {} as Record<string, typeof logs>)

  // 按 Agent 分组
  const groupedByAgent = logs.reduce((acc, log) => {
    const agent = log.agent_type
    if (!acc[agent]) acc[agent] = []
    acc[agent].push(log)
    return acc
  }, {} as Record<string, typeof logs>)

  // 按项目分组
  const groupedByProject = logs.reduce((acc, log) => {
    const project = log.front_matter?.project || '未知项目'
    if (!acc[project]) acc[project] = []
    acc[project].push(log)
    return acc
  }, {} as Record<string, typeof logs>)

  const currentGroup = groupBy === 'date' ? groupedByDate : groupBy === 'agent' ? groupedByAgent : groupedByProject

  const stats = {
    totalLogs: logs.length,
    totalTokens: logs.reduce((sum, l) => sum + (l.tokens_estimate || 0), 0),
    agents: new Set(logs.map(l => l.agent_type)).size,
    projects: new Set(logs.map(l => l.front_matter?.project || '未知')).size,
    avgTokens: logs.length ? Math.round(logs.reduce((sum, l) => sum + (l.tokens_estimate || 0), 0) / logs.length) : 0,
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">会话时间轴</h1>
          <p className="text-gray-500 mt-1">按时间、Agent 或项目查看执行历史</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
            {(['date', 'agent', 'project'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  groupBy === g ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {g === 'date' ? '按日期' : g === 'agent' ? '按 Agent' : '按项目'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="总会话数" value={stats.totalLogs} icon={<Hash />} color="bg-primary-100" />
        <StatCard title="总 Token" value={stats.totalTokens.toLocaleString()} icon={<TrendingUp />} color="bg-green-100" />
        <StatCard title="Agent 类型" value={stats.agents} icon={<Bot />} color="bg-purple-100" />
        <StatCard title="项目数" value={stats.projects} icon={<FileText />} color="bg-blue-100" />
        <StatCard title="平均 Token/会话" value={stats.avgTokens.toLocaleString()} icon={<Clock />} color="bg-orange-100" />
      </div>

      {/* 时间轴 */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {groupBy === 'date' ? '按日期' : groupBy === 'agent' ? '按 Agent 类型' : '按项目'} 分组
            <span className="text-sm font-normal text-gray-500 ml-2">({Object.keys(currentGroup).length} 组)</span>
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {Object.entries(currentGroup)
            .sort(([a], [b]) => {
              if (groupBy === 'date') return b.localeCompare(a) // 日期倒序
              return a.localeCompare(b)
            })
            .map(([key, items]) => (
              <TimelineGroup key={key} label={key} items={items} groupBy={groupBy} />
            ))}
          {logs.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>所选时间范围内暂无会话记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={clsx('p-2.5 rounded-xl', color)}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function TimelineGroup({ label, items, groupBy }: { label: string; items: MarkdownLog[]; groupBy: string }) {
  const totalTokens = items.reduce((sum, l) => sum + (l.tokens_estimate || 0), 0)
  const agents = [...new Set(items.map(l => l.agent_type))]
  const projects = [...new Set(items.map(l => l.front_matter?.project || '未知'))]

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="p-4 bg-gray-50 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            {groupBy === 'date' && <Calendar className="h-5 w-5 text-primary-600" />}
            {groupBy === 'agent' && <Bot className="h-5 w-5 text-primary-600" />}
            {groupBy === 'project' && <FileText className="h-5 w-5 text-primary-600" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {groupBy === 'date' ? format(new Date(label), 'yyyy年M月d日 (EEEE)', { locale: zhCN }) : label}
            </h3>
            <p className="text-sm text-gray-500">
              {items.length} 个会话 · {totalTokens.toLocaleString()} tokens · {agents.join(', ')}
            </p>
          </div>
        </div>
        {projects.length > 1 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2">
            {projects.map(p => (
              <span key={p} className="badge badge-gray text-xs">{p}</span>
            ))}
          </div>
        )}
        <div className="p-4 space-y-3">
          {items
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((log) => (
              <TimelineItem key={log.id} log={log} />
            ))}
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ log }: { log: MarkdownLog }) {
  return (
    <div className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
        <Hash className="h-5 w-5 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-primary">{log.agent_type}</span>
          <span className="font-medium text-gray-900 truncate max-w-md">
            {log.title || log.file_path.split('/').pop()?.replace('.md', '')}
          </span>
          <span className="text-sm text-gray-500">
            {format(new Date(log.created_at), 'HH:mm:ss')}
          </span>
          {log.front_matter?.task_type && (
            <span className="badge badge-gray">{log.front_matter.task_type}</span>
          )}
          {log.front_matter?.project && (
            <span className="badge badge-gray">{log.front_matter.project}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 line-clamp-1">{log.summary}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 flex-wrap">
          {log.tokens_estimate && <span>≈ {(log.tokens_estimate / 1000).toFixed(1)}k tokens</span>}
          {log.front_matter?.tools_used && log.front_matter.tools_used.length > 0 && (
            <span>工具: {log.front_matter.tools_used.slice(0, 5).join(', ')}</span>
          )}
          {log.front_matter?.duration_seconds && (
            <span>耗时: {Math.round(log.front_matter.duration_seconds / 60)}分钟</span>
          )}
        </div>
      </div>
    </div>
  )
}