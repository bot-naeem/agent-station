import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, Hash, Tag } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { markdownApi, type MarkdownCalendarItem } from '../../services/api'
import { clsx } from 'clsx'
import { Link } from '@tanstack/react-router'

interface DayCellProps {
  date: Date
  data?: MarkdownCalendarItem
  currentMonth: Date
  onClick: (date: Date) => void
}

function DayCell({ date, data, currentMonth, onClick }: DayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth)
  const today = isToday(date)

  if (!isCurrentMonth) {
    return (
      <button
        onClick={() => onClick(date)}
        className="h-24 w-full p-1 text-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
        disabled
      >
        <span className="text-sm">{format(date, 'd')}</span>
      </button>
    )
  }

  const count = data?.count || 0
  const agents = data?.agents || {}

  return (
    <button
      onClick={() => onClick(date)}
      className={clsx(
        'h-24 w-full p-2 relative rounded-lg transition-colors text-left',
        today ? 'bg-primary-50 border-2 border-primary-300' : 'hover:bg-gray-50 border border-gray-100'
      )}
    >
      <div className={clsx('text-sm font-medium', today ? 'text-primary-700' : 'text-gray-900')}>
        {format(date, 'd')}
      </div>
      {count > 0 && (
        <div className="mt-1 space-y-1 overflow-hidden">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <FileText className="h-3 w-3" />
            <span>{count} 篇</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(agents).slice(0, 3).map(([agent, cnt]) => (
              <span key={agent} className="badge badge-gray text-[10px] px-1.5">
                {agent}: {cnt}
              </span>
            ))}
            {Object.keys(agents).length > 3 && (
              <span className="badge badge-gray text-[10px] px-1.5">+{Object.keys(agents).length - 3}</span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

export function LogsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const { data: calendarData } = useQuery({
    queryKey: ['markdown-calendar', currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    queryFn: () => markdownApi.calendar(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
  })

  const calendarMap = new Map(calendarData?.map(d => [d.date, d]) || [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1, locale: zhCN })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1, locale: zhCN })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handleDayClick = (date: Date) => {
    if (isSameMonth(date, currentMonth)) {
      setSelectedDate(date)
    }
  }

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日志日历</h1>
          <p className="text-gray-500 mt-1">按日期浏览和管理 Agent 执行日志</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/logs/list" className="btn-secondary">
            <FileText className="h-4 w-4 mr-2" />
            列表视图
          </Link>
        </div>
      </div>

      {/* 日历网格 */}
      <div className="card overflow-hidden">
        {/* 月份导航 */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            {format(currentMonth, 'yyyy年M月', { locale: zhCN })}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              date={day}
              data={calendarMap.get(format(day, 'yyyy-MM-dd'))}
              currentMonth={currentMonth}
              onClick={handleDayClick}
            />
          ))}
        </div>
      </div>

      {/* 选中日期详情 */}
      {selectedDate && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(selectedDate, 'yyyy年M月d日', { locale: zhCN })} 的日志
            </h2>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <LogsListForDate date={selectedDate} />
        </div>
      )}
    </div>
  )
}

// 复用的列表组件
function LogsListForDate({ date }: { date: Date }) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const { data, isLoading } = useQuery({
    queryKey: ['markdown-logs-by-date', dateStr],
    queryFn: () => markdownApi.list({ start_date: dateStr, end_date: dateStr, page_size: 50 }),
  })

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">加载中...</div>
  }

  if (!data?.items.length) {
    return <div className="p-8 text-center text-gray-500">该日期暂无日志</div>
  }

  return (
    <div className="divide-y divide-gray-100">
      {data.items.map((log) => (
        <Link
          key={log.id}
          to="/logs/$date/$agent/$fileName"
          params={{
            date: log.log_date,
            agent: log.agent_type,
            fileName: log.file_path.split('/').pop() || '',
          }}
          className="block p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
              <Hash className="h-6 w-6 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="badge badge-primary">{log.agent_type}</span>
                <h3 className="font-medium text-gray-900 truncate">
                  {log.title || log.file_path.split('/').pop()?.replace('.md', '')}
                </h3>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-1">{log.summary}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                <span>{log.tokens_estimate ? `${(log.tokens_estimate / 1000).toFixed(1)}k tokens` : ''}</span>
                {log.front_matter?.tags && log.front_matter.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {log.front_matter.tags.slice(0, 3).join(', ')}
                    {log.front_matter.tags.length > 3 && ` +${log.front_matter.tags.length - 3}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}