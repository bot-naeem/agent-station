import { useEffect, useState } from 'react';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { FileText, Tag, Calendar, User, Clock, Search, Filter, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '@/services/api';

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
}

interface BlogListResponse {
  items: BlogPost[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface BlogStats {
  total_posts: number;
  published_posts: number;
  draft_posts: number;
  by_category: Record<string, number>;
  by_agent: Record<string, number>;
  top_tags: { tag: string; count: number }[];
}

function statusLabel(s: 'draft' | 'published' | 'archived' | string) {
  const map: Record<string, string> = { published: 'Published', draft: 'Draft', archived: 'Archived' };
  return map[s] || s;
}

function statusColor(s: 'draft' | 'published' | 'archived' | string) {
  const map: Record<string, string> = { published: 'bg-emerald-100 text-emerald-700', draft: 'bg-amber-100 text-amber-700', archived: 'bg-gray-100 text-gray-600' };
  return map[s] || 'bg-gray-100 text-gray-600';
}

interface BlogSearchParams {
  category?: string;
  tag?: string;
  query?: string;
  page?: number;
  [key: string]: string | number | undefined;
}

export function BlogsList() {
  const search = useSearch({ strict: false }) as BlogSearchParams;
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [stats, setStats] = useState<BlogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [filters, setFilters] = useState({
    category: search.category || '',
    tag: search.tag || '',
    query: search.query || '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setAllTags] = useState<string[]>([]);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (filters.category) params.set('category', filters.category);
      if (filters.tag) params.set('tag', filters.tag);
      if (filters.query) params.set('query', filters.query);
      params.set('status', 'published');

      const res = await api.get<BlogListResponse>(`/blog?${params.toString()}`);
      setBlogs(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get<BlogStats>('/blog/stats');
      setStats(res.data);
      // Extract unique categories and tags
      const cats = Object.keys(res.data.by_category).sort();
      const allTags = res.data.top_tags.map(t => t.tag);
      setCategories(cats);
      setAllTags(allTags);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBlogs();
    fetchStats();
  }, [page, filters]);

  const handleFilterChange = (key: keyof BlogSearchParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
    const newParams: BlogSearchParams = { ...search };
    if (value) newParams[key] = value;
    else delete newParams[key];
    newParams.page = 1;
    navigate({ search: newParams as any });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const newParams: BlogSearchParams = { ...search };
    newParams.query = filters.query;
    newParams.page = 1;
    navigate({ search: newParams as any });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
            <Link
              to="/blog/editor/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              New Post
            </Link>
          </div>

          {/* Search & Filters */}
          <div className={`pb-4 ${showFilters ? 'border-b border-gray-100' : ''}`}>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.query}
                  onChange={e => handleFilterChange('query', e.target.value)}
                  placeholder="Search title, summary, content..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </form>

            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-2">
                <select
                  value={filters.category}
                  onChange={e => handleFilterChange('category', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filters.tag}
                  onChange={e => handleFilterChange('tag', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">All Tags</option>
                  {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(filters.category || filters.tag) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ ...filters, category: '', tag: '' });
                      const newParams: BlogSearchParams = { ...search };
                      delete newParams.category;
                      delete newParams.tag;
                      newParams.page = 1;
                      navigate({ search: newParams as any });
                    }}
                    className="px-3 py-2 text-sm text-primary-600 hover:text-primary-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span className="font-medium text-gray-900">Stats:</span>
            <span>Total <strong className="text-gray-900">{stats.total_posts}</strong> posts</span>
            <span className="text-emerald-600">Published {stats.published_posts}</span>
            <span className="text-amber-600">Draft {stats.draft_posts}</span>
            <span>Categories {Object.keys(stats.by_category).length}</span>
          </div>
        </div>
      )}

      {/* Blog Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded-full px-3 w-20" />
                  <div className="h-6 bg-gray-200 rounded-full px-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No blog posts yet</h3>
            <p className="text-gray-500 mb-6">No published blogs yet. Create the first one!</p>
            <Link
              to="/blog/editor/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <FileText className="h-4 w-4" />
              New Post
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogs.map(blog => (
                <article
                  key={blog.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col"
                >
                  {blog.cover_image && (
                    <Link to={`/blog/${blog.slug}` as any}>
                      <img
                        src={blog.cover_image}
                        alt={blog.title}
                        className="w-full h-48 object-cover"
                      />
                    </Link>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {blog.category && (
                        <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">
                          {blog.category}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColor(blog.status)}`}>
                        {statusLabel(blog.status)}
                      </span>
                    </div>
                    <Link to={`/blog/${blog.slug}` as any}>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-primary-600 transition-colors">
                        {blog.title}
                      </h2>
                    </Link>
                    {blog.summary && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">{blog.summary}</p>
                    )}
                    {blog.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {blog.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                        {blog.tags.length > 4 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                            +{blog.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{blog.agent_name || 'Unknown Author'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{blog.published_at ? format(new Date(blog.published_at), 'yyyy-MM-dd') : format(new Date(blog.created_at), 'yyyy-MM-dd')}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {total > pageSize && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-600">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
