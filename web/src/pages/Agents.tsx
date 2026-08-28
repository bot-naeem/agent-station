import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { agentApi, authApi, type AgentResponse, type AgentCreate } from '../services/api'
import { clsx } from 'clsx'
import {
  ShieldCheck, Plus, Search, Bot, Activity, Crown, Clock,
  Pencil, KeyRound, Trash2, X, AlertTriangle, Copy, Check,
  Loader2, Ban, Fingerprint, Info, BookOpen, Terminal, Plug, Wrench,
  GraduationCap, Copy as CopyIcon,
} from 'lucide-react'

/* ---------------------------------- 常量 ---------------------------------- */

type DialogMode = 'create' | 'edit' | null

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''
const MCP_SSE_URL = `${APP_ORIGIN}/mcp/sse`
const DOCS_URL = `${APP_ORIGIN}/api/v1/docs/mcp`
const SKILL_TEMPLATE_URL = `${APP_ORIGIN}/api/v1/docs/skill-template`

const PERMISSION_META: Record<string, { label: string; desc: string; chip: string }> = {
  read_own:      { label: '读取自己', desc: '仅可查看自己写入的日志',           chip: 'bg-gray-100 text-gray-700 ring-gray-200' },
  read_all:      { label: '读取全部', desc: '可查看所有 Agent 的日志',          chip: 'bg-sky-50 text-sky-700 ring-sky-200' },
  read_specific: { label: '指定读取', desc: '仅可查看下方指定 Agent 的日志',    chip: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
  write_own:     { label: '写入自己', desc: '可写入自己的日志',                 chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  admin:         { label: '管理员',   desc: '拥有平台全部管理权限',             chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
}

const PERMISSION_ORDER = ['read_own', 'read_all', 'read_specific', 'write_own', 'admin']

const AVATAR_COLORS = [
  'bg-gradient-to-br from-sky-500 to-blue-600',
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-amber-500 to-orange-600',
  'bg-gradient-to-br from-rose-500 to-pink-600',
  'bg-gradient-to-br from-indigo-500 to-blue-600',
]

const defaultForm: AgentCreate = {
  name: '',
  display_name: '',
  description: '',
  permissions: ['read_own', 'write_own'],
  readable_agent_ids: [],
  is_active: true,
}

/* ---------------------------------- 工具 ---------------------------------- */

function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(name: string) {
  return (name || '?').slice(0, 2).toUpperCase()
}

function timeAgo(iso: string | null): string {
  if (!iso) return '从未使用'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

/* ---------------------------------- 弹窗外壳 ---------------------------------- */

function Modal({ onClose, children, wide = false }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5',
          'max-h-[90vh] flex flex-col modal-pop',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ icon, title, desc, onClose }: { icon: React.ReactNode; title: string; desc?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {desc && <p className="mt-0.5 text-sm text-gray-500">{desc}</p>}
        </div>
      </div>
      <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

/* ---------------------------- 复制代码块 ---------------------------- */

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }
  return (
    <div className="group relative">
      {label && <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>}
      <div className="relative overflow-x-auto rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 scrollbar-thin">
        <code className="block select-all whitespace-pre font-mono text-xs leading-relaxed text-gray-100">{code}</code>
        <button
          onClick={copy}
          title="复制"
          className={clsx(
            'absolute right-2 top-2 rounded-md p-1.5 transition-all',
            copied
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-gray-800 text-gray-400 opacity-0 hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {copied && (
          <span className="absolute right-10 top-2.5 text-[11px] font-medium text-emerald-400">已复制</span>
        )}
      </div>
    </div>
  )
}


/* ---------------------------- Skill 模板弹窗 ---------------------------- */

function SkillTemplateModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(SKILL_TEMPLATE_URL)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text() })
      .then(setContent)
      .catch(() => setError('模板加载失败，请稍后重试'))
      .finally(() => setLoading(false))
  }, [])

  const copyAll = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader
        icon={<GraduationCap className="h-5 w-5" />}
        title="Agent Skill 模板"
        desc="三区结构：①人设定义 ②平台规范（通用勿改）③自定义区。填好存为 ~/.claude/skills/<name>/SKILL.md"
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4 scrollbar-thin">
        {/* 获取方式 */}
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
          <p className="mb-2 text-xs leading-relaxed text-violet-800">
            让本机智能体 <b>web-fetch</b> 下面这个地址获取完整模板，或直接复制右侧全文：
          </p>
          <CopyBlock code={SKILL_TEMPLATE_URL} />
        </div>

        {/* 模板全文 */}
        <div className="relative">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">模板全文（Markdown）</span>
            <button
              onClick={copyAll}
              disabled={loading || !content}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                copied ? 'bg-emerald-50 text-emerald-600' : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40',
              )}
            >
              {copied ? <><Check className="h-3.5 w-3.5" />已复制全文</> : <><CopyIcon className="h-3.5 w-3.5" />复制全文</>}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-16 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载模板中…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">{error}</div>
          ) : (
            <pre className="max-h-[46vh] overflow-auto rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-gray-100 scrollbar-thin select-all">
{content}
            </pre>
          )}
        </div>

        {/* 使用提示 */}
        <div className="rounded-xl border border-gray-200 p-3.5">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Info className="h-4 w-4 text-gray-400" />使用步骤
          </h4>
          <ol className="list-decimal space-y-0.5 pl-5 text-xs leading-relaxed text-gray-600">
            <li>复制全文保存为 <code className="rounded bg-gray-100 px-1 font-mono">~/.claude/skills/&lt;name&gt;/SKILL.md</code></li>
            <li>填 ① 人设区、③ 自定义区（② 平台规范区通用勿改）</li>
            <li>确保本机已完成 MCP 连接，会话内 <code className="rounded bg-gray-100 px-1 font-mono">/&lt;name&gt;</code> 召唤测试</li>
          </ol>
        </div>
      </div>

      <div className="flex items-center justify-end rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
        <button onClick={onClose} className="btn-secondary min-w-[88px]">关闭</button>
      </div>
    </Modal>
  )
}

/* ---------------------------- MCP 接入指南弹窗 ---------------------------- */

function GuideModal({ agent, onClose }: { agent?: AgentResponse | null; onClose: () => void }) {
  const keyHint = 'sk-as-xxxxxxxxxxxx'
  const addCommand = `claude mcp add agent-station --transport sse \\\n  "${MCP_SSE_URL}?api_key=${keyHint}"`

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader
        icon={<BookOpen className="h-5 w-5" />}
        title={agent ? `接入指南 · ${agent.display_name}` : '智能体接入指南'}
        desc="把下面的命令复制给智能体执行，即可接入平台"
        onClose={onClose}
      />

      <div className="space-y-6 overflow-y-auto px-6 py-5 scrollbar-thin">
        {/* 第一步 */}
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">1</span>
            获取 API Key
          </h4>
          <p className="text-sm leading-relaxed text-gray-600">
            在本页面点击「新建 Agent」创建账号，创建成功后会生成一次性 API Key（<code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">sk-as-</code> 开头）。
            {agent && <> 若该 Agent 的 Key 已丢失，可点击列表中的钥匙图标「轮换 Key」重新生成。</>}
          </p>
        </section>

        {/* 第二步 */}
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">2</span>
            <Terminal className="h-4 w-4 text-gray-400" />
            在智能体机器上执行连接命令
          </h4>
          <div className="space-y-3">
            <CopyBlock label="Claude Code" code={addCommand.replace(keyHint, '你的API_KEY')} />

            <CopyBlock
              label="OpenCode（编辑 ~/.config/opencode/opencode.json）"
              code={`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-station": {
      "type": "remote",
      "url": "${MCP_SSE_URL}?api_key=你的API_KEY"
    }
  }
  // ...其他配置保持不变
}`}
            />
            <p className="-mt-1 text-xs leading-relaxed text-gray-400">
              OpenCode v2 用扁平结构 <code className="rounded bg-gray-100 px-1 font-mono">mcp.{"{server-name}"}</code>，无需 servers 嵌套层，也无需 enabled 字段（默认启用）。改完重启 OpenCode 生效。
            </p>

            <CopyBlock
              label="Antigravity CLI（编辑 ~/.gemini/config/mcp_config.json，全局生效；项目级放 ./.agents/mcp_config.json）"
              code={`{
  "mcpServers": {
    "agent-station": {
      "serverUrl": "${MCP_SSE_URL}?api_key=你的API_KEY"
    }
  }
}`}
            />
            <p className="-mt-1 text-xs leading-relaxed text-gray-400">
              注意：Antigravity 远程 SSE 用 <code className="rounded bg-gray-100 px-1 font-mono">serverUrl</code> 字段（不同于 Claude Code 的 type+url 结构）。改完需新起 agy 会话才加载。
              <br />服务端已支持 <b>双协议</b>：同一 URL 同时兼容 SSE (GET) 与 Streamable HTTP (POST)，Antigravity 自动使用 Streamable HTTP 直连。
            </p>

            <CopyBlock
              label="其他 MCP 客户端（Codex / Cline 等）连接地址"
              code={`${MCP_SSE_URL}?api_key=你的API_KEY`}
            />
            <CopyBlock
              label="验证连接"
              code={'claude mcp list\n# 应显示: agent-station ... ✓ Connected\n\nopencode\n# 会话内输入 /mcp 或直接调用工具，应显示: ● ✓ agent-station connected\n\nagy\n# 启动即自动拉取工具列表；日志排查看 ~/.gemini/antigravity-cli/cli.log'}
            />
          </div>
        </section>

        {/* 第三步 */}
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">3</span>
            <Wrench className="h-4 w-4 text-gray-400" />
            接入后智能体可用工具
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['write_log', '写入工作日志（title + content 必填）'],
              ['read_logs', '读取最近日志'],
              ['search_logs', '全文搜索历史日志'],
              ['get_stats', '查看日志统计'],
            ].map(([name, desc]) => (
              <div key={name} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
                <code className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-700">{name}</code>
                <span className="text-xs leading-relaxed text-gray-600">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 给智能体看的完整说明 */}
        <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-900">
            <Plug className="h-4 w-4" />
            直接发给智能体的完整指令（一键复制）
          </h4>
          <p className="mb-2 text-xs leading-relaxed text-violet-700/80">
            把下面这段话连同命令一起粘贴给智能体，它就知道该做什么了：
          </p>
          <CopyBlock
            code={`请接入 Agent Station 平台，用于记录你的工作日志。

1. 根据你的客户端类型完成 MCP 连接（把 你的API_KEY 替换为实际值）:

   如果你是 Claude Code，执行命令:
   claude mcp add agent-station --transport sse "${MCP_SSE_URL}?api_key=你的API_KEY"
   然后执行 claude mcp list 确认 agent-station 显示 ✓ Connected

   如果你是 OpenCode，编辑 ~/.config/opencode/opencode.json 添加:
   {
     "mcp": {
       "agent-station": {
         "type": "remote",
         "url": "${MCP_SSE_URL}?api_key=你的API_KEY"
       }
     }
   }
   保存后重启 OpenCode，确认 agent-station 显示 connected

如果你是 Antigravity CLI (agy)，编辑 ~/.gemini/config/mcp_config.json 添加:
  {
    "mcpServers": {
      "agent-station": {
        "serverUrl": "${MCP_SSE_URL}?api_key=你的API_KEY"
      }
    }
  }
  注意用 serverUrl 字段；保存后新起 agy 会话即加载（服务端双协议：同一 URL 支持 SSE 与 Streamable HTTP）

2. 之后每次完成重要任务，主动调用 write_log 工具记录:
   - title: 一句话概括做了什么
   - content: Markdown 格式，包含 背景 / 操作步骤 / 结果 / 踩坑
   - tags: 便于检索的关键词数组

3. 需要回顾历史工作时，用 read_logs 按日期或 Agent 名过滤，用 search_logs 关键词搜索。`}
          />
        </section>

        {/* Web-fetch 文档 */}
        <section className="rounded-xl border border-gray-200 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Info className="h-4 w-4 text-gray-400" />
            智能体自主获取文档（web-fetch）
          </h4>
          <p className="mb-2 text-xs text-gray-500">
            让智能体抓取这个纯 Markdown 地址，即可获得完整接入文档，无需人工传话：
          </p>
          <CopyBlock code={DOCS_URL} />
        </section>

        {/* 常见问题 */}
        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">常见问题</h4>
          <div className="space-y-1.5 text-xs leading-relaxed text-gray-600">
            <p>· <b>401 Unauthorized</b>：检查 api_key 参数名是下划线，且 Key 完整（含 sk-as- 前缀）</p>
            <p>· <b>Key 丢失</b>：Key 仅创建时显示一次，丢失需在列表中轮换</p>
            <p>· <b>权限隔离</b>：普通 Agent 只能读写自己的日志，由 RBAC 自动控制</p>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
        <button onClick={onClose} className="btn-secondary min-w-[88px]">关闭</button>
      </div>
    </Modal>
  )
}

/* ---------------------------------- 主组件 ---------------------------------- */

export function Agents() {
  const navigate = useNavigate()

  const [agents, setAgents] = useState<AgentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [isAdmin, setIsAdmin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [dialog, setDialog] = useState<DialogMode>(null)
  const [form, setForm] = useState<AgentCreate>(defaultForm)
  const [editing, setEditing] = useState<AgentResponse | null>(null)
  const [formError, setFormError] = useState('')

  const [rotateTarget, setRotateTarget] = useState<AgentResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AgentResponse | null>(null)
  const [confirmError, setConfirmError] = useState('')

  const [keyDialog, setKeyDialog] = useState<{ agentName: string; key: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [guide, setGuide] = useState<{ open: boolean; agent: AgentResponse | null }>({ open: false, agent: null })
  const [skillOpen, setSkillOpen] = useState(false)

  /* ------------------------------ 数据加载 ------------------------------ */

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const me = await authApi.me()
        setIsAdmin(me.is_superuser ?? false)
      } catch {
        setIsAdmin(false)
      } finally {
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (authChecked && !isAdmin) navigate({ to: '/login' })
  }, [authChecked, isAdmin, navigate])

  const fetchAgents = async () => {
    try {
      const res = await agentApi.list({ page_size: 100 })
      setAgents(res.items)
    } catch (e: any) {
      setError(e.response?.data?.detail || '加载 Agent 列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authChecked && isAdmin) fetchAgents()
  }, [authChecked, isAdmin])

  /* ------------------------------ 操作 ------------------------------ */

  const openCreate = () => {
    setForm(defaultForm)
    setEditing(null)
    setFormError('')
    setDialog('create')
  }

  const openEdit = (a: AgentResponse) => {
    setEditing(a)
    setForm({
      name: a.name,
      display_name: a.display_name,
      description: a.description || '',
      permissions: [...a.permissions],
      readable_agent_ids: [...a.readable_agent_ids],
      is_active: a.is_active,
    })
    setFormError('')
    setDialog('edit')
  }

  const togglePermission = (p: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (form.permissions.length === 0) {
      setFormError('请至少选择一项权限')
      return
    }
    setSubmitting(true)
    try {
      if (dialog === 'create') {
        const res = await agentApi.create(form)
        setDialog(null)
        if (res.api_key) setKeyDialog({ agentName: res.display_name || res.name, key: res.api_key })
        await fetchAgents()
      } else if (dialog === 'edit' && editing) {
        await agentApi.update(editing.id, {
          display_name: form.display_name,
          description: form.description,
          permissions: form.permissions,
          readable_agent_ids: form.readable_agent_ids,
          is_active: form.is_active,
        })
        setDialog(null)
        await fetchAgents()
      }
    } catch (e: any) {
      setFormError(e.response?.data?.detail || '操作失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRotate = async () => {
    if (!rotateTarget) return
    setSubmitting(true)
    setConfirmError('')
    try {
      const res = await agentApi.rotateKey(rotateTarget.id)
      setRotateTarget(null)
      if (res.api_key) setKeyDialog({ agentName: res.display_name || res.name, key: res.api_key })
      await fetchAgents()
    } catch (e: any) {
      setConfirmError(e.response?.data?.detail || '轮换失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    setConfirmError('')
    try {
      await agentApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      await fetchAgents()
    } catch (e: any) {
      setConfirmError(e.response?.data?.detail || '删除失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const copyKey = async () => {
    if (!keyDialog) return
    try {
      await navigator.clipboard.writeText(keyDialog.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard 不可用时忽略 */
    }
  }

  /* ------------------------------ 派生数据 ------------------------------ */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agents.filter(a => {
      if (statusFilter === 'active' && !a.is_active) return false
      if (statusFilter === 'inactive' && a.is_active) return false
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        a.display_name.toLowerCase().includes(q) ||
        a.agent_type.toLowerCase().includes(q)
      )
    })
  }, [agents, search, statusFilter])

  const stats = useMemo(() => [
    { label: 'Agent 总数', value: agents.length, icon: Bot, tone: 'bg-sky-50 text-sky-600' },
    { label: '启用中', value: agents.filter(a => a.is_active).length, icon: Activity, tone: 'bg-emerald-50 text-emerald-600' },
    { label: '管理员权限', value: agents.filter(a => a.permissions.includes('admin')).length, icon: Crown, tone: 'bg-violet-50 text-violet-600' },
    { label: '近 7 天活跃', value: agents.filter(a => a.last_used_at && Date.now() - new Date(a.last_used_at).getTime() < 7 * 86400_000).length, icon: Clock, tone: 'bg-amber-50 text-amber-600' },
  ], [agents])

  /* ------------------------------ 渲染 ------------------------------ */

  if (!authChecked || (authChecked && !isAdmin)) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在验证权限…</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* 页头 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 text-white shadow-lg shadow-primary-500/25">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agent 权限管理</h1>
            <p className="text-sm text-gray-500">管理接入平台的 Agent 账号、API Key 与访问权限</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button onClick={() => setGuide({ open: true, agent: null })} className="btn-secondary">
            <BookOpen className="mr-1.5 h-4 w-4" />
            接入指南
          </button>
          <button onClick={() => setSkillOpen(true)} className="btn-secondary">
            <GraduationCap className="mr-1.5 h-4 w-4" />
            Skill 模板
          </button>
          <button onClick={openCreate} className="btn-primary shadow-sm shadow-primary-500/25">
            <Plus className="mr-1.5 h-4 w-4" />
            新建 Agent
          </button>
        </div>
      </div>

      {/* 全局错误 */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{s.label}</span>
              <div className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', s.tone)}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索名称、显示名或类型…"
              className="input pl-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            {([['all', '全部'], ['active', '启用'], ['inactive', '禁用']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  statusFilter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {label}
                {!loading && (
                  <span className="ml-1.5 text-xs tabular-nums text-gray-400">
                    {v === 'all' ? agents.length : v === 'active' ? agents.filter(a => a.is_active).length : agents.filter(a => !a.is_active).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 表格 */}
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-gray-50" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{agents.length === 0 ? '还没有 Agent' : '没有匹配的结果'}</p>
              <p className="mt-1 text-sm text-gray-500">
                {agents.length === 0 ? '创建第一个 Agent，开始接入你的 AI 助手' : '试试调整搜索关键词或筛选条件'}
              </p>
            </div>
            {agents.length === 0 && (
              <button onClick={openCreate} className="btn-primary mt-2">
                <Plus className="mr-1.5 h-4 w-4" />新建 Agent
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3.5">Agent</th>
                  <th className="px-4 py-3.5">类型</th>
                  <th className="px-4 py-3.5">权限</th>
                  <th className="px-4 py-3.5">状态</th>
                  <th className="px-4 py-3.5">最后活跃</th>
                  <th className="px-5 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(a => (
                  <tr key={a.id} className="group transition-colors hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm', avatarColor(a.name))}>
                          {initials(a.display_name || a.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{a.display_name}</div>
                          <div className="truncate font-mono text-xs text-gray-400">{a.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 ring-1 ring-gray-200">
                        <Fingerprint className="h-3 w-3 text-gray-400" />
                        {a.agent_type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {PERMISSION_ORDER.filter(p => a.permissions.includes(p)).map(p => (
                          <span key={p} title={PERMISSION_META[p].desc} className={clsx('cursor-default rounded-full px-2 py-0.5 text-xs font-medium ring-1', PERMISSION_META[p].chip)}>
                            {PERMISSION_META[p].label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
                        a.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-50 text-gray-500 ring-gray-200',
                      )}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', a.is_active ? 'animate-pulse bg-emerald-500' : 'bg-gray-400')} />
                        {a.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-xs', a.last_used_at ? 'text-gray-600' : 'italic text-gray-400')}>
                        {timeAgo(a.last_used_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(a)} title="编辑" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setGuide({ open: true, agent: a })} title="接入指南" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-violet-50 hover:text-violet-600">
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setConfirmError(''); setRotateTarget(a) }} title="轮换 API Key" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-amber-50 hover:text-amber-600">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setConfirmError(''); setDeleteTarget(a) }} title="删除" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 表格底部统计 */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
            共 {agents.length} 个 Agent，当前显示 {filtered.length} 个
          </div>
        )}
      </div>

      {/* ------------------------- 新建 / 编辑 弹窗 ------------------------- */}
      {dialog && (
        <Modal onClose={() => setDialog(null)} wide>
          <ModalHeader
            icon={dialog === 'create' ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            title={dialog === 'create' ? '新建 Agent' : `编辑 · ${editing?.display_name}`}
            desc={dialog === 'create' ? '创建后将生成一次性 API Key，用于 Agent 接入平台' : '修改配置后立即生效，API Key 保持不变'}
            onClose={() => setDialog(null)}
          />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-6 overflow-y-auto px-6 py-5 scrollbar-thin">
              {/* 基本信息 */}
              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">基本信息</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-gray-700">
                      名称 <span className="text-red-500">*</span>
                    </span>
                    <input
                      required
                      disabled={dialog === 'edit'}
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="my-agent-01"
                      className="input font-mono disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <span className="mt-1 block text-xs text-gray-400">{dialog === 'edit' ? '创建后不可修改' : '唯一标识，建议使用小写字母与连字符'}</span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-gray-700">
                      显示名称 <span className="text-red-500">*</span>
                    </span>
                    <input
                      required
                      value={form.display_name}
                      onChange={e => setForm({ ...form, display_name: e.target.value })}
                      placeholder="我的服务器 Agent"
                      className="input"
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700">描述</span>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="这台机器的用途、负责人等备注信息（可选）"
                    className="input resize-none"
                  />
                </label>
              </section>

              {/* 权限配置 */}
              <section>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">权限配置</h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PERMISSION_ORDER.map(p => {
                    const meta = PERMISSION_META[p]
                    const checked = form.permissions.includes(p)
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => togglePermission(p)}
                        className={clsx(
                          'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                          checked
                            ? 'border-primary-500 bg-primary-50/50 ring-1 ring-primary-500'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        <span className={clsx(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white',
                        )}>
                          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className={clsx('block text-sm font-medium', checked ? 'text-primary-900' : 'text-gray-900')}>{meta.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-gray-500" title={meta.desc}>{meta.desc}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {form.permissions.includes('read_specific') && (
                  <label className="mt-4 block rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
                    <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-cyan-900">
                      <Info className="h-4 w-4" />
                      可读取的 Agent 列表
                    </span>
                    <input
                      value={form.readable_agent_ids.join(', ')}
                      onChange={e => setForm({ ...form, readable_agent_ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="codex, claude-code"
                      className="input font-mono"
                    />
                    <span className="mt-1.5 block text-xs text-cyan-700/70">多个 Agent 名称用英文逗号分隔</span>
                  </label>
                )}
              </section>

              {/* 启用状态 */}
              <section className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">启用此 Agent</div>
                  <div className="mt-0.5 text-xs text-gray-500">禁用后该 Agent 的 API Key 将立即失效</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={clsx(
                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    form.is_active ? 'bg-primary-600' : 'bg-gray-200',
                  )}
                >
                  <span className={clsx(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    form.is_active ? 'translate-x-6' : 'translate-x-1',
                  )} />
                </button>
              </section>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary">取消</button>
              <button type="submit" disabled={submitting} className="btn-primary min-w-[96px]">
                {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : dialog === 'create' ? '创建并生成 Key' : '保存更改'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------- 轮换 Key 确认弹窗 ------------------------- */}
      {rotateTarget && (
        <Modal onClose={() => setRotateTarget(null)}>
          <ModalHeader
            icon={<KeyRound className="h-5 w-5" />}
            title="轮换 API Key"
            desc={`${rotateTarget.display_name}（${rotateTarget.name}）`}
            onClose={() => setRotateTarget(null)}
          />
          <div className="space-y-4 px-6 py-5">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="space-y-1 text-sm text-amber-800">
                <p className="font-medium">此操作不可撤销</p>
                <p className="text-amber-700/80">轮换后旧 Key 将立即失效，所有使用旧 Key 的 Agent 连接都会中断。新 Key 仅在生成时显示一次。</p>
              </div>
            </div>
            {confirmError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {confirmError}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
            <button onClick={() => setRotateTarget(null)} className="btn-secondary">取消</button>
            <button onClick={handleRotate} disabled={submitting} className="btn-danger min-w-[110px]">
              {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '确认轮换'}
            </button>
          </div>
        </Modal>
      )}

      {/* ------------------------- 删除确认弹窗 ------------------------- */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <ModalHeader
            icon={<Ban className="h-5 w-5" />}
            title="删除 Agent"
            desc={`${deleteTarget.display_name}（${deleteTarget.name}）`}
            onClose={() => setDeleteTarget(null)}
          />
          <div className="space-y-4 px-6 py-5">
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <div className="space-y-1 text-sm text-red-800">
                <p className="font-medium">确定要删除这个 Agent 吗？</p>
                <p className="text-red-700/80">该 Agent 的 API Key 将永久失效，此操作不可恢复。历史日志将保留。</p>
              </div>
            </div>
            {confirmError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {confirmError}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">取消</button>
            <button onClick={handleDelete} disabled={submitting} className="btn-danger min-w-[110px]">
              {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '确认删除'}
            </button>
          </div>
        </Modal>
      )}

      {/* ------------------------- API Key 展示弹窗 ------------------------- */}
      {keyDialog && (
        <Modal onClose={() => setKeyDialog(null)}>
          <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">API Key 已生成</h3>
            <p className="mt-1 text-sm text-gray-500">
              为 <span className="font-medium text-gray-700">{keyDialog.agentName}</span> 生成了新的 API Key
            </p>

            <div className="mt-5 w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">API Key</span>
                <button
                  onClick={copyKey}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    copied ? 'text-emerald-600' : 'text-primary-600 hover:bg-primary-50',
                  )}
                >
                  {copied ? <><Check className="h-3.5 w-3.5" />已复制</> : <><Copy className="h-3.5 w-3.5" />复制</>}
                </button>
              </div>
              <code className="block select-all break-all font-mono text-sm text-gray-900">{keyDialog.key}</code>
            </div>

            <div className="mt-4 w-full text-left">
              <CopyBlock
                label={`智能体连接命令（${keyDialog.agentName} 专用，已含真实 Key）`}
                code={`claude mcp add agent-station --transport sse \\\n  "${MCP_SSE_URL}?api_key=${keyDialog.key}"`}
              />
            </div>

            <div className="mt-4 flex w-full items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-amber-800">
                请立即复制并妥善保存，<span className="font-semibold">关闭后将无法再次查看</span>。
                如丢失只能重新轮换。上方连接命令已包含真实 Key，可直接发给智能体执行。
              </p>
            </div>

            <button onClick={() => setKeyDialog(null)} className="btn-primary mt-6 w-full">
              我已保存，关闭
            </button>
          </div>
        </Modal>
      )}

      {/* ------------------------- MCP 接入指南弹窗 ------------------------- */}
      {guide.open && (
        <GuideModal agent={guide.agent} onClose={() => setGuide({ open: false, agent: null })} />
      )}

      {/* ------------------------- Skill 模板弹窗 ------------------------- */}
      {skillOpen && <SkillTemplateModal onClose={() => setSkillOpen(false)} />}
    </div>
  )
}
