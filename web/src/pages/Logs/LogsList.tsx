import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Calendar, Tag, Hash, Download, Upload } from 'lucide-react'
import { format } from 'date-fns'
import { markdownApi, type MarkdownLog, type MarkdownLogSearchParams } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { clsx } from 'clsx'
import { Link } from '@tanstack/react-router'

export function LogsList() {
  const [searchParams, setSearchParams] = useState<MarkdownLogSearchParams>({
    page: 1,
    page_size: 20,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState<MarkdownLog | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['markdown-logs', searchParams],
    queryFn: () => markdownApi.list(searchParams),
    placeholderData: (previous) => previous,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(prev => ({ ...prev, page: 1 }))
  }

  const handleFilterChange = (key: keyof MarkdownLogSearchParams, value: any) => {
    setSearchParams(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setSearchParams(prev => ({ ...prev, page }))
  }

  const handleExport = async () => {
    // 导出当前筛选条件下的所有日志
    const resp = await markdownApi.list({ ...searchParams, page_size: 1000 })
    const content = resp.items.map(log => 
      `---\n${JSON.stringify(log.front_matter, null, 2)}\n---\n\n${log.content || ''}`
    ).join('\n\n---\n\n')
    
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-logs-${format(new Date(), 'yyyy-MM-dd')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日志列表</h1>
          <p className="text-gray-500 mt-1">搜索、筛选和管理所有 Agent 执行日志</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            导出 Markdown
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            批量导入
            <input type="file" multiple accept=".md,.markdown" className="hidden" onChange={(e) => {
              const files = Array.from(e.target.files || [])
              // TODO: 实现批量导入
            }} />
          </label>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="card p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索标题、摘要、内容..."
                value={searchParams.query || ''}
                onChange={(e) => handleFilterChange('query', e.target.value || undefined)}
                className="input pl-10"
              />
            </div>
            <button type="button" onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
              <Filter className="h-4 w-4 mr-2" />
              高级筛选
            </button>
          </div>

          {showFilters && (
            <div className="grid gap-4 md:grid-cols-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent 类型</label>
                <select
                  value={searchParams.agent_type || ''}
                  onChange={(e) => handleFilterChange('agent_type', e.target.value || undefined)}
                  className="input"
                >
                  <option value="">全部</option>
                  <option value="opencode">opencode</option>
                  <option value="claude">claude</option>
                  <option value="codex">codex</option>
                  <option value="gemini">gemini</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  value={searchParams.start_date || ''}
                  onChange={(e) => handleFilterChange('start_date', e.target.value || undefined)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                <input
                  type="date"
                  value={searchParams.end_date || ''}
                  onChange={(e) => handleFilterChange('end_date', e.target.value || undefined)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
                <input
                  type="text"
                  placeholder="docker, rag, deploy"
                  value={searchParams.tags?.join(', ') || ''}
                  onChange={(e) => handleFilterChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean) || undefined)}
                  className="input"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* 结果列表 */}
      <div className="card">
        {isLoading || !data ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">加载中...</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Hash className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p>未找到匹配的日志</p>
            <p className="text-sm">尝试调整筛选条件或搜索关键词</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                共 {data.total} 条记录 · 第 {data.page} / {data.total_pages} 页
              </p>
              <select
                value={searchParams.page_size}
                onChange={(e) => handleFilterChange('page_size', parseInt(e.target.value))}
                className="input w-auto"
              >
                <option value={10}>每页 10 条</option>
                <option value={20}>每页 20 条</option>
                <option value={50}>每页 50 条</option>
                <option value={100}>每页 100 条</option>
              </select>
            </div>

            <div className="divide-y divide-gray-100">
              {data.items.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Hash className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge badge-primary">{log.agent_type}</span>
                        <Link
                          to="/logs/$date/$agent/$fileName"
                          params={{
                            date: log.log_date,
                            agent: log.agent_type,
                            fileName: log.file_path.split('/').pop() || '',
                          }}
                          className="font-medium text-gray-900 hover:text-primary-600 truncate max-w-md"
                        >
                          {log.title || log.file_path.split('/').pop()?.replace('.md', '')}
                        </Link>
                        <span className="text-sm text-gray-500 whitespace-nowrap">
                          {format(new Date(log.log_date), 'yyyy-MM-dd')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{log.summary}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                        </span>
                        {log.tokens_estimate && (
                          <span className="flex items-center gap-1">
                            <span>≈</span>
                            {(log.tokens_estimate / 1000).toFixed(1)}k tokens
                          </span>
                        )}
                        {log.front_matter?.tags && log.front_matter.tags.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {log.front_matter.tags.slice(0, 5).join(', ')}
                            {log.front_matter.tags.length > 5 && ` +${log.front_matter.tags.length - 5}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {data.total_pages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  显示 {(data.page - 1) * data.page_size + 1} - {Math.min(data.page * data.page_size, data.total)} / {data.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(data.page - 1)}
                    disabled={data.page === 1}
                    className="btn-secondary disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => handlePageChange(data.page + 1)}
                    disabled={data.page === data.total_pages}
                    className="btn-secondary disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情模态框 */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setSelectedLog(null)}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedLog(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
                <div className="flex items-center gap-3">
                  <span className="badge badge-primary">{selectedLog.agent_type}</span>
                  <h3 className="font-semibold text-gray-900 truncate">
                    {selectedLog.title || selectedLog.file_path.split('/').pop()?.replace('.md', '')}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="mb-4 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                  <span>{format(new Date(selectedLog.log_date), 'yyyy-MM-dd')}</span>
                  <span>{format(new Date(selectedLog.created_at), 'HH:mm:ss')}</span>
                  {selectedLog.tokens_estimate && <span>≈ {(selectedLog.tokens_estimate / 1000).toFixed(1)}k tokens</span>}
                </div>
                <MarkdownViewer content={selectedLog.content || ''} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}