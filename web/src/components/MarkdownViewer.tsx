import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clsx } from 'clsx'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={clsx('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        code: ({ children, ...props }) => (
          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
            <code {...props}>{children}</code>
          </pre>
        ),
        pre: ({ children, ...props }) => (
          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm" {...props}>
            {children}
          </pre>
        ),
        blockquote: ({ children, ...props }) => (
          <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-600 dark:text-gray-300" {...props}>
            {children}
          </blockquote>
        ),
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" {...props}>
              {children}
            </table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th className="px-3 py-2 bg-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="px-3 py-2 text-sm text-gray-900" {...props}>
            {children}
          </td>
        ),
        tr: ({ children, ...props }) => (
          <tr className="hover:bg-gray-50" {...props}>
            {children}
          </tr>
        ),
      }}>
        {content}
      </ReactMarkdown>
    </div>
  )
}