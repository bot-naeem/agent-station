import { useParams, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Hash, Tag, Clock, Copy, Check } from 'lucide-react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { markdownApi } from '../../services/api'
import { MarkdownViewer } from '../../components/MarkdownViewer'
import { useState } from 'react'

export function LogDetail() {
  const { date, agent, fileName } = useParams({ from: '/logs/$date/$agent/$fileName' })
  const filePath = `${date}/${agent}/${fileName}`

  const { data: log, isLoading } = useQuery({
    queryKey: ['markdown-log-by-path', filePath],
    queryFn: async () => {
      // Find matching log via list
      const resp = await markdownApi.list({ 
        start_date: date, 
        end_date: date, 
        agent_type: agent,
        page_size: 100 
      })
      return resp.items.find(l => l.file_path === filePath)
    },
    enabled: !!date && !!agent && !!fileName,
  })

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (log?.content) {
      await navigator.clipboard.writeText(log.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!log) {
    return (
      <div className="text-center py-12">
        <Hash className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Log not found</h2>
        <p className="text-gray-500 mt-2">Log file not found</p>
        <Link to="/logs" className="btn-primary mt-4 inline-block">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to logs
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <Link to="/logs" className="inline-flex items-center text-gray-500 hover:text-gray-700 text-sm">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to logs
      </Link>

      {/* Header info */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="badge badge-primary">{log.agent_type}</span>
              <h1 className="text-2xl font-bold text-gray-900">
                {log.title || log.file_path.split('/').pop()?.replace('.md', '')}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(log.log_date), 'MMM d, yyyy', { locale: enUS })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(log.created_at), 'HH:mm:ss')}
              </span>
              {log.tokens_estimate && (
                <span className="flex items-center gap-1 text-primary-600">
                  ≈ {(log.tokens_estimate / 1000).toFixed(1)}k tokens
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="btn-secondary"
              disabled={!log.content}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy all
                </>
              )}
            </button>
            <Link to="/logs" className="btn-secondary">
              List view
            </Link>
          </div>
        </div>

        {/* Front Matter metadata */}
        {log.front_matter && Object.keys(log.front_matter).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Metadata</h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-sm">
              {Object.entries(log.front_matter).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-500">{key}</span>
                  <pre className="mt-1 font-mono text-xs text-gray-900 whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {log.front_matter?.tags && log.front_matter.tags.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-gray-400" />
            {log.front_matter.tags.map((tag: string) => (
              <span key={tag} className="badge badge-gray">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Markdown content */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Content</h2>
        </div>
        <div className="p-6">
          <MarkdownViewer content={log.content || ''} />
        </div>
      </div>
    </div>
  )
}
