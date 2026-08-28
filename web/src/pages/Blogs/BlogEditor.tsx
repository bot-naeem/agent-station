import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Save, Loader2, Check, Tag as TagIcon, Image, Eye, PenLine, Globe, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { blogApi, type BlogPost } from '../../services/api';
import { MarkdownViewer } from '../../components/MarkdownViewer';
import { clsx } from 'clsx';

export function BlogEditor() {
  const { blogId } = useParams({ strict: false }) as { blogId?: string };
  const isNew = !blogId;
  const navigate = useNavigate();

  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [category, setCategory] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [content, setContent] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedTick, setSavedTick] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const categories = ['技术', '随笔', '教程', '公告', '其他'];

  /* 加载博客 */
  useEffect(() => {
    if (isNew) {
      setLoading(false);
      setStatus('draft');
      return;
    }
    setLoading(true);
    blogApi.get(blogId!)
      .then(data => {
        setBlog(data);
        setTitle(data.title || '');
        setSlug(data.slug || '');
        setSummary(data.summary || '');
        setCoverImage(data.cover_image || '');
        setCategory(data.category || '');
        setTagsStr(((data.tags as string[]) || []).join(', '));
        setStatus(data.status);
        setContent(data.content ?? '');
      })
      .catch(e => setLoadError(e.response?.data?.detail || '加载失败'))
      .finally(() => setLoading(false));
  }, [blogId, isNew]);

  /* Ctrl/Cmd + S 保存 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const touch = () => setDirty(true);

  const handleSave = async () => {
    if (saving) return;
    if (!title.trim()) {
      setSaveError('标题不能为空');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const tags = tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        summary: summary.trim() || undefined,
        cover_image: coverImage.trim() || undefined,
        category: category.trim() || undefined,
        tags,
        status,
        content,
      };
      if (isNew) {
        const res = await blogApi.create(payload);
        navigate({ to: `/blog/editor/${res.id}` as any });
      } else {
        await blogApi.update(blogId!, payload);
        setDirty(false);
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 2000);
        window.dispatchEvent(new CustomEvent('alp:invalidate-blogs'));
      }
    } catch (e: any) {
      setSaveError(e.response?.data?.detail || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setStatus('published');
    await handleSave();
  };

  const handleBack = () => {
    navigate({ to: '/blog' as any });
  };

  const words = content.length;

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">加载博客…</span>
      </div>
    );
  }

  if (loadError || (!isNew && !blog)) {
    return (
      <div className="flex h-[calc(100vh-10rem)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{loadError || '博客不存在'}</p>
        <button onClick={handleBack} className="btn-secondary">返回列表</button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-none flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* ─── 顶栏 ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={handleBack}
            title="返回列表"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); touch() }}
            placeholder="博客标题"
            className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-lg font-bold text-gray-900 transition-colors placeholder-gray-300 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span className={clsx(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium',
            savedTick ? 'bg-emerald-50 text-emerald-600' : dirty ? 'bg-amber-50 text-amber-600' : status === 'published' ? 'bg-emerald-50 text-emerald-600' : status === 'archived' ? 'bg-gray-50 text-gray-600' : 'bg-amber-50 text-amber-600',
          )}>
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin" />保存中…</>
            ) : savedTick ? (
              <><Check className="h-3 w-3" />已保存</>
            ) : dirty ? (
              <>未保存</>
            ) : status === 'published' ? (
              <><Globe className="h-3 w-3" />已发布</>
            ) : status === 'archived' ? (
              <><Lock className="h-3 w-3" />已归档</>
            ) : (
              <><PenLine className="h-3 w-3" />草稿</>
            )}
          </span>

          {/* Category */}
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); touch() }}
            className="px-3 py-1.5 border border-transparent bg-gray-50 rounded-lg text-xs text-gray-700 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none"
          >
            <option value="">分类</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Tags */}
          <div className="flex items-center gap-1.5">
            <TagIcon className="h-3.5 w-3.5 text-gray-400" />
            <input
              value={tagsStr}
              onChange={e => { setTagsStr(e.target.value); touch() }}
              placeholder="标签，逗号分隔"
              className="w-40 rounded-lg border border-transparent bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 transition-colors placeholder-gray-400 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? '创建' : '保存'}
          </button>
          {!isNew && status !== 'published' && (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-1.5 text-sm shadow-sm"
            >
              <Globe className="h-4 w-4" />
              发布
            </button>
          )}
        </div>
      </div>

      {/* ─── 元信息条 ─── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 pb-2 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1 font-medium text-gray-500">
          <TagIcon className="h-3 w-3" />
          {category || '未分类'}
        </span>
        <span className={clsx(
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
          status === 'published' && 'bg-emerald-50 text-emerald-700',
          status === 'draft' && 'bg-amber-50 text-amber-700',
          status === 'archived' && 'bg-gray-50 text-gray-600',
        )}>
          {status === 'published' && <Globe className="h-3 w-3" />}
          {status === 'draft' && <PenLine className="h-3 w-3" />}
          {status === 'archived' && <Lock className="h-3 w-3" />}
          {statusLabel(status)}
        </span>
        <span className="font-mono">{blog?.slug || '新建博客'}</span>
        <span className="ml-auto tabular-nums">{words} 字符 · ≈{Math.ceil(words / 4)} tokens · ⌘S 保存</span>
      </div>

      {/* ─── 扩展字段 ─── */}
      <div className="mt-3 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-gray-400" />
          <input
            value={coverImage}
            onChange={e => { setCoverImage(e.target.value); touch() }}
            placeholder="封面图 URL (可选)"
            className="flex-1 min-w-[200px] rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-gray-400" />
          <input
            value={summary}
            onChange={e => { setSummary(e.target.value); touch() }}
            placeholder="摘要 (可选，列表页显示)"
            className="flex-1 min-w-[200px] rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 hover:border-gray-200 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* 移动端 Tab 切换 */}
      <div className="mt-2 flex items-center gap-0.5 self-start rounded-lg bg-gray-100 p-0.5 lg:hidden">
        {([['write', '编辑', PenLine], ['preview', '预览', Eye]] as const).map(([v, label, Icon]) => (
          <button
            key={v}
            onClick={() => setMobileTab(v)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              mobileTab === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ─── 分屏主体 ─── */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:grid-cols-2 lg:divide-x lg:divide-gray-200">
        {/* 左：源码编辑 */}
        <div className={clsx('min-h-0 min-w-0', mobileTab === 'write' ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            <PenLine className="h-3 w-3" />
            Markdown 源码
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => { setContent(e.target.value); touch(); setMobileTab('write') }}
            spellCheck={false}
            placeholder="# 用 Markdown 书写博客内容…"
            className="h-[calc(100%-2rem)] w-full resize-none px-5 py-4 font-mono text-[13.5px] leading-relaxed text-gray-800 focus:outline-none scrollbar-thin"
          />
        </div>

        {/* 右：实时预览 */}
        <div className={clsx('min-h-0 min-w-0 bg-white', mobileTab === 'preview' ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            <Eye className="h-3 w-3" />
            实时预览
          </div>
          <div className="h-[calc(100%-2rem)] overflow-auto px-6 py-4 scrollbar-thin">
            {content.trim()
              ? <MarkdownViewer content={content} />
              : <p className="text-sm text-gray-300">左侧输入内容后这里会实时渲染</p>}
          </div>
        </div>
      </div>

      {/* 底部错误提示 */}
      {saveError && (
        <div className="pt-2 text-xs text-red-600">{saveError}</div>
      )}
    </div>
  );
}

function statusLabel(s: 'draft' | 'published' | 'archived' | string) {
  const map: Record<string, string> = { published: '已发布', draft: '草稿', archived: '归档' };
  return map[s] || s;
}

function statusColor(s: 'draft' | 'published' | 'archived' | string) {
  const map: Record<string, string> = { published: 'bg-emerald-100 text-emerald-700', draft: 'bg-amber-100 text-amber-700', archived: 'bg-gray-100 text-gray-600' };
  return map[s] || 'bg-gray-100 text-gray-600';
}