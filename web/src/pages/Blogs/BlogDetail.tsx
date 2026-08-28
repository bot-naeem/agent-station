import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ArrowLeft, Edit, Tag, Calendar, User, Clock, Share2, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface BlogPost {
  id: string;
  agent_id: string;
  agent_name: string | null;
  title: string;
  slug: string;
  summary: string | null;
  cover_image: string | null;
  status: 'draft' | 'published' | 'archived';
  category: string | null;
  tags: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  content: string;
  front_matter: Record<string, any>;
}

function statusLabel(s: 'draft' | 'published' | 'archived' | string) {
  const map: Record<string, string> = { published: '已发布', draft: '草稿', archived: '归档' };
  return map[s] || s;
}

function statusColor(s: 'draft' | 'published' | 'archived' | string) {
  const map: Record<string, string> = { published: 'bg-emerald-100 text-emerald-700', draft: 'bg-amber-100 text-amber-700', archived: 'bg-gray-100 text-gray-600' };
  return map[s] || 'bg-gray-100 text-gray-600';
}

export function BlogDetail() {
  const params = useParams({ strict: false }) as { slug: string };
  const slug = params.slug;
  const navigate = useNavigate();
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const fetchBlog = async () => {
      setLoading(true);
      try {
        const res = await api.get<BlogPost>(`/blog/${slug}`);
        setBlog(res.data);
      } catch (e: any) {
        if (e.response?.status === 404) {
          setError('文章不存在');
        } else if (e.response?.status === 403) {
          setError('无权访问该文章');
        } else {
          setError('加载失败，请稍后重试');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [slug]);

  const copyLink = async () => {
    if (!blog) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('链接已复制');
    } catch {
      // fallback
      prompt('复制链接:', window.location.href);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error || '文章不存在'}</h2>
          <Link to="/blog" className="text-primary-600 hover:underline">返回博客列表</Link>
        </div>
      </div>
    );
  }

  const isOwner = false; // TODO: check from auth context

  return (
    <article className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              to="/blog"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
            >
              <ArrowLeft className="h-5 w-5" />
              返回列表
            </Link>
            <div className="flex items-center gap-2">
              {isOwner && (
                <Link
                  to={`/blog/editor/${blog.id}` as any}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  编辑
                </Link>
              )}
              <button onClick={copyLink} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="复制链接">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {blog.category && (
              <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
                {blog.category}
              </span>
            )}
            <span className={`px-3 py-1 text-sm rounded-full ${statusColor(blog.status)}`}>
              {statusLabel(blog.status)}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">{blog.title}</h1>
          {blog.summary && (
            <p className="text-lg text-gray-600 mb-6 border-l-4 border-primary-500 pl-4 italic">{blog.summary}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{blog.agent_name || '未知作者'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <time dateTime={blog.published_at || blog.created_at}>
                {blog.published_at ? format(new Date(blog.published_at), 'yyyy年MM月dd日', { locale: zhCN }) : format(new Date(blog.created_at), 'yyyy年MM月dd日', { locale: zhCN })}
              </time>
            </div>
            {blog.updated_at !== blog.created_at && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>更新于 {format(new Date(blog.updated_at), 'yyyy-MM-dd', { locale: zhCN })}</span>
              </div>
            )}
          </div>
          {blog.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blog.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/blog?tag=${encodeURIComponent(tag)}` as any}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 text-sm transition-colors"
                >
                  <Tag className="h-3.5 w-3.5" />
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {blog.cover_image && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img src={blog.cover_image} alt={blog.title} className="w-full h-auto max-h-[500px] object-cover" />
          </div>
        )}

        <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-primary-600 hover:prose-a:text-primary-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {blog.content}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ExternalLink className="h-4 w-4" />
              <span>原文链接: {window.location.href}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/blog" className="text-sm text-primary-600 hover:underline">
                ← 返回博客列表
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </article>
  );
}