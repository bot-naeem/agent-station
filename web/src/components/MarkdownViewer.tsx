import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clsx } from 'clsx'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={clsx(
      // Base prose: elegant reading experience
      'prose max-w-none prose-zinc dark:prose-invert',
      // Control typography scale via className, default to prose-sm with refined overrides
      'prose-p:leading-7 prose-p:text-[15px] prose-p:text-gray-700 dark:prose-p:text-gray-300',
      'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-gray-900 dark:prose-headings:text-gray-100',
      'prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4 prose-h1:pb-3 prose-h1:border-b prose-h1:border-gray-100',
      'prose-h2:text-xl prose-h2:mt-7 prose-h2:mb-3 prose-h2:font-semibold',
      'prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2',
      'prose-a:text-primary-600 prose-a:font-medium prose-a:no-underline hover:prose-a:text-primary-700 hover:prose-a:underline prose-a:decoration-primary-200 prose-a:underline-offset-4',
      'prose-strong:text-gray-900 prose-strong:font-semibold dark:prose-strong:text-gray-100',
      'prose-code:text-[13px] prose-code:font-mono prose-code:font-medium',
      'prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5 prose-li:text-[15px] prose-li:text-gray-700',
      'prose-hr:my-8 prose-hr:border-gray-100',
      'prose-img:rounded-xl prose-img:shadow-sm prose-img:ring-1 prose-img:ring-gray-900/5',
      'prose-blockquote:border-l-2 prose-blockquote:border-gray-200 prose-blockquote:pl-5 prose-blockquote:italic prose-blockquote:text-gray-600',
      className
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        // Inline code vs block code
        code: ({ children, className: codeClassName, ...props }) => {
          const isBlock = !!codeClassName
          if (isBlock) {
            return (
              <code className={clsx('font-mono text-[13px] leading-relaxed', codeClassName)} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] font-medium text-gray-800 ring-1 ring-gray-200/60 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700" {...props}>
              {children}
            </code>
          )
        },
        pre: ({ children, ...props }) => (
          <pre className="not-prose my-5 overflow-x-auto rounded-xl bg-[#0b0e14] p-4 text-sm leading-relaxed shadow-sm ring-1 ring-gray-900/10 scrollbar-thin" {...props}>
            {children}
          </pre>
        ),
        blockquote: ({ children, ...props }) => (
          <blockquote className="my-6 rounded-r-xl border-l-4 border-primary-500 bg-primary-50/40 py-3 pl-5 pr-4 italic text-gray-700 dark:bg-primary-900/10 dark:text-gray-300" {...props}>
            {children}
          </blockquote>
        ),
        table: ({ children, ...props }) => (
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200" {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }) => (
          <thead className="bg-gray-50/80" {...props}>{children}</thead>
        ),
        th: ({ children, ...props }) => (
          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="px-4 py-3 text-sm leading-relaxed text-gray-700" {...props}>
            {children}
          </td>
        ),
        tr: ({ children, ...props }) => (
          <tr className="even:bg-gray-50/50 hover:bg-gray-50" {...props}>
            {children}
          </tr>
        ),
        hr: (props) => <hr className="my-8 border-gray-100" {...props} />,
        a: ({ children, ...props }) => (
          <a className="font-medium text-primary-600 underline decoration-primary-200 underline-offset-4 hover:text-primary-700 hover:decoration-primary-300" {...props}>
            {children}
          </a>
        ),
        h1: ({ children, ...props }) => (
          <h1 className="mt-8 mb-4 border-b border-gray-100 pb-3 text-2xl font-bold tracking-tight text-gray-900" {...props}>{children}</h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight text-gray-900" {...props}>{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="mt-6 mb-2 text-lg font-semibold text-gray-900" {...props}>{children}</h3>
        ),
        ul: ({ children, ...props }) => (
          <ul className="my-4 list-disc pl-6 marker:text-gray-400" {...props}>{children}</ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="my-4 list-decimal pl-6 marker:text-gray-400 marker:font-medium" {...props}>{children}</ol>
        ),
        li: ({ children, ...props }) => (
          <li className="my-1.5 pl-1 text-[15px] leading-7 text-gray-700" {...props}>{children}</li>
        ),
        p: ({ children, ...props }) => (
          <p className="my-4 text-[15px] leading-7 text-gray-700" {...props}>{children}</p>
        ),
      }}>
        {content}
      </ReactMarkdown>
    </div>
  )
}