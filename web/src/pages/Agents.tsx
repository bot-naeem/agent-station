import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { agentApi, authApi, type AgentResponse, type AgentCreate } from '../services/api'
import { clsx } from 'clsx'
import {
 ShieldCheck, Plus, Search, Bot, Activity, Clock,
 Pencil, KeyRound, Trash2, X, AlertTriangle, Copy, Check,
 Loader2, Ban, Fingerprint, Info, BookOpen, Terminal, Plug, Wrench,
 GraduationCap, Copy as CopyIcon,
} from 'lucide-react'

/* ---------------------------------- Constants ---------------------------------- */

type DialogMode = 'create' | 'edit' | null

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''
const MCP_SSE_URL = `${APP_ORIGIN}/mcp/sse`
const DOCS_URL = `${APP_ORIGIN}/api/v1/docs/mcp`
const SKILL_TEMPLATE_URL = `${APP_ORIGIN}/api/v1/docs/skill-template`

const PERMISSION_META: Record<string, { label: string; desc: string; chip: string }> = {
 read_own:   { label: 'Read Own', desc: 'Can only view logs written by itself',     chip: 'bg-gray-50 text-gray-600 ring-gray-200' },
 read_all:   { label: 'Read All', desc: 'Can view logs from all Agents',     chip: 'bg-gray-50 text-gray-600 ring-gray-200' },
 read_specific: { label: 'Read Specific', desc: 'Can only view logs from specified Agents below',  chip: 'bg-gray-50 text-gray-600 ring-gray-200' },
 write_own:   { label: 'Write Own', desc: 'Can write its own logs',        chip: 'bg-gray-50 text-gray-600 ring-gray-200' },
}

const PERMISSION_ORDER = ['read_own', 'read_all', 'read_specific', 'write_own']

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

/* ---------------------------------- Utils ---------------------------------- */

function avatarColor(name: string) {
 let h = 0
 for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
 return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(name: string) {
 return (name || '?').slice(0, 2).toUpperCase()
}

function timeAgo(iso: string | null): string {
 if (!iso) return 'Never used'
 const diff = Date.now() - new Date(iso).getTime()
 const m = Math.floor(diff / 60000)
 if (m < 1) return 'Just now'
 if (m < 60) return `${m} minutes ago`
 const h = Math.floor(m / 60)
 if (h < 24) return `${h} hours ago`
 const d = Math.floor(h / 24)
 if (d < 30) return `${d} days ago`
 return new Date(iso).toLocaleDateString('en-US')
}

/* ---------------------------------- Modal Shell ---------------------------------- */

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

/* ---------------------------- Copy Code Block ---------------------------- */

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
     title="Copy"
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
     <span className="absolute right-10 top-2.5 text-[11px] font-medium text-emerald-400">Copied</span>
    )}
   </div>
  </div>
 )
}


/* ---------------------------- Skill Template Modal ---------------------------- */

function SkillTemplateModal({ onClose }: { onClose: () => void }) {
 const [content, setContent] = useState('')
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [copied, setCopied] = useState(false)

 useEffect(() => {
  fetch(SKILL_TEMPLATE_URL)
   .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text() })
   .then(setContent)
   .catch(() => setError('Failed to load template, please try again later'))
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
    title="Agent Skill Template"
    desc="Three-section structure: 1. Persona 2. Platform Rules (do not edit) 3. Custom. Fill and save as ~/.claude/skills/<name>/SKILL.md"
    onClose={onClose}
   />

   <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4 scrollbar-thin">
    {/* How to Get */}
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
     <p className="mb-2 text-xs leading-relaxed text-violet-800">
      Have your local agent <b>web-fetch</b> the URL below to get the full template, or copy the full text on the right:
     </p>
     <CopyBlock code={SKILL_TEMPLATE_URL} />
    </div>

    {/* Full Template */}
    <div className="relative">
     <div className="mb-1.5 flex items-center justify-between">
      <span className="text-xs font-medium text-gray-500">Full Template (Markdown)</span>
      <button
       onClick={copyAll}
       disabled={loading || !content}
       className={clsx(
        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        copied ? 'bg-emerald-50 text-emerald-600' : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40',
       )}
      >
       {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><CopyIcon className="h-3.5 w-3.5" />Copy All</>}
      </button>
     </div>

     {loading ? (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-16 text-sm text-gray-400">
       <Loader2 className="h-4 w-4 animate-spin" />
       Loading template...
      </div>
     ) : error ? (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">{error}</div>
     ) : (
      <pre className="max-h-[46vh] overflow-auto rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-gray-100 scrollbar-thin select-all">
{content}
      </pre>
     )}
    </div>

    {/* Usage Tips */}
    <div className="rounded-xl border border-gray-200 p-3.5">
     <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
      <Info className="h-4 w-4 text-gray-400" />Usage Steps
     </h4>
     <ol className="list-decimal space-y-0.5 pl-5 text-xs leading-relaxed text-gray-600">
      <li>Copy the full text and save as <code className="rounded bg-gray-100 px-1 font-mono">~/.claude/skills/&lt;name&gt;/SKILL.md</code></li>
      <li>Fill section 1 (Persona) and 3 (Custom) — leave section 2 (Platform Rules) unchanged</li>
      <li>Ensure MCP is connected locally, then in the session <code className="rounded bg-gray-100 px-1 font-mono">/&lt;name&gt;</code> to test</li>
     </ol>
    </div>
   </div>

   <div className="flex items-center justify-end rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
    <button onClick={onClose} className="btn-secondary min-w-[88px]">Close</button>
   </div>
  </Modal>
 )
}

/* ---------------------------- MCP Guide Modal ---------------------------- */

function GuideModal({ agent, onClose }: { agent?: AgentResponse | null; onClose: () => void }) {
 const keyHint = 'sk-as-xxxxxxxxxxxx'
 const addCommand = `claude mcp add agent-station --transport sse \\\n "${MCP_SSE_URL}?api_key=${keyHint}"`

 return (
  <Modal onClose={onClose} wide>
   <ModalHeader
    icon={<BookOpen className="h-5 w-5" />}
    title={agent ? `Guide · ${agent.display_name}` : 'Agent Connection Guide'}
    desc="Copy the commands below to your agent to connect to the platform"
    onClose={onClose}
   />

   <div className="space-y-6 overflow-y-auto px-6 py-5 scrollbar-thin">
    {/* Step 1 */}
    <section>
     <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">1</span>
      Get API Key
     </h4>
     <p className="text-sm leading-relaxed text-gray-600">
      Click "New Agent" on this page to create an account. After creation, a one-time API Key will be generated (<code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">sk-as-</code> prefix).
      {agent && <> If the Key is lost, click the key icon "Rotate Key" in the list to regenerate it.</>}
     </p>
    </section>

    {/* Step 2 */}
    <section>
     <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">2</span>
      <Terminal className="h-4 w-4 text-gray-400" />
      Run the connection command on the agent machine
     </h4>
     <div className="space-y-3">
      <CopyBlock label="Claude Code" code={addCommand.replace(keyHint, 'YOUR_API_KEY')} />

      <CopyBlock
       label="OpenCode (edit ~/.config/opencode/opencode.json)"
       code={`{
 "$schema": "https://opencode.ai/config.json",
 "mcp": {
  "agent-station": {
   "type": "remote",
   "url": "${MCP_SSE_URL}?api_key=YOUR_API_KEY"
  }
 }
 // ...other configs remain unchanged
}`}
      />
      <p className="-mt-1 text-xs leading-relaxed text-gray-400">
       OpenCode v2 uses a flat structure <code className="rounded bg-gray-100 px-1 font-mono">mcp.{"{server-name}"}</code>, no servers nesting and no enabled field (enabled by default). Restart OpenCode after editing.
      </p>

      <CopyBlock
       label="Antigravity CLI (edit ~/.gemini/config/mcp_config.json for global; ./.agents/mcp_config.json for project-level)"
       code={`{
 "mcpServers": {
  "agent-station": {
   "serverUrl": "${MCP_SSE_URL}?api_key=YOUR_API_KEY"
  }
 }
}`}
      />
      <p className="-mt-1 text-xs leading-relaxed text-gray-400">
       Note: Antigravity remote SSE uses <code className="rounded bg-gray-100 px-1 font-mono">serverUrl</code> field (different from Claude Code's type+url structure). Start a new agy session after editing to load.
       <br />Server supports <b>dual protocol</b>: the same URL is compatible with both SSE (GET) and Streamable HTTP (POST); Antigravity automatically uses Streamable HTTP.
      </p>

      <CopyBlock
       label="Other MCP Clients (Codex / Cline etc.) — Connection URL"
       code={`${MCP_SSE_URL}?api_key=YOUR_API_KEY`}
      />
      <CopyBlock
       label="Verify Connection"
       code={'claude mcp list\n# should show: agent-station ... ✓ Connected\n\nopencode\n# run in session /mcp or call tools directly, should show: ● ✓ agent-station connected\n\nagy\n# automatically fetches tool list on start; check logs at ~/.gemini/antigravity-cli/cli.log'}
      />
     </div>
    </section>

    {/* Step 3 */}
    <section>
     <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">3</span>
      <Wrench className="h-4 w-4 text-gray-400" />
      Available Tools After Connection
     </h4>
     <div className="grid gap-2 sm:grid-cols-2">
      {[
       ['write_log', 'Write work log (title + content required)'],
       ['read_logs', 'Read recent logs'],
       ['search_logs', 'Full-text search history logs'],
       ['get_stats', 'View log statistics'],
      ].map(([name, desc]) => (
       <div key={name} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
        <code className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-700">{name}</code>
        <span className="text-xs leading-relaxed text-gray-600">{desc}</span>
       </div>
      ))}
     </div>
    </section>

    {/* Complete Instructions for the Agent */}
    <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
     <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-900">
      <Plug className="h-4 w-4" />
      Complete Instructions to Send to Your Agent (One-Click Copy)
     </h4>
     <p className="mb-2 text-xs leading-relaxed text-violet-700/80">
      Paste the following text along with the commands to your agent and it will know what to do:
     </p>
     <CopyBlock
      code={`Please connect to the Agent Station platform to record your work logs.

1. Complete the MCP connection according to your client type (replace Your API_KEY with the actual value):

  If you are using Claude Code, run:
  claude mcp add agent-station --transport sse "${MCP_SSE_URL}?api_key=YOUR_API_KEY"
  Then run claude mcp list to confirm agent-station shows ✓ Connected

  If you are using OpenCode, edit ~/.config/opencode/opencode.json and add:
  {
   "mcp": {
    "agent-station": {
     "type": "remote",
     "url": "${MCP_SSE_URL}?api_key=YOUR_API_KEY"
    }
   }
  }
  Save and restart OpenCode, confirm agent-station shows connected

If you are using Antigravity CLI (agy), edit ~/.gemini/config/mcp_config.json and add:
 {
  "mcpServers": {
   "agent-station": {
    "serverUrl": "${MCP_SSE_URL}?api_key=YOUR_API_KEY"
   }
  }
 }
 Note to use the serverUrl field; start a new agy session after saving to load (server dual protocol: same URL supports both SSE and Streamable HTTP)

2. Afterwards, after each important task, proactively call the write_log tool to record:
  - title: One-sentence summary of what was done
  - content: Markdown format, including Background / Steps / Result / Pitfalls
  - tags: Keyword array for easy retrieval

3. When you need to review past work, use read_logs to filter by date or Agent name, and search_logs for keyword search.`}
     />
    </section>

    {/* Web-fetch Docs */}
    <section className="rounded-xl border border-gray-200 p-4">
     <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
      <Info className="h-4 w-4 text-gray-400" />
      Agent Self-Service Docs (web-fetch)
     </h4>
     <p className="mb-2 text-xs text-gray-500">
      Have the agent fetch this plain Markdown URL to get the full connection docs — no manual relay needed:
     </p>
     <CopyBlock code={DOCS_URL} />
    </section>

    {/* FAQ */}
    <section>
     <h4 className="mb-2 text-sm font-semibold text-gray-900">FAQ</h4>
     <div className="space-y-1.5 text-xs leading-relaxed text-gray-600">
      <p>· <b>401 Unauthorized</b>: check that the api_key param uses underscore and the Key is complete (with sk-as- prefix)</p>
      <p>· <b>Key Lost</b>: Key is shown only once at creation; if lost, rotate it in the list</p>
      <p>· <b>Permission Isolation</b>: Regular Agents can only read/write their own logs, controlled automatically by RBAC</p>
     </div>
    </section>
   </div>

   <div className="flex items-center justify-end rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
    <button onClick={onClose} className="btn-secondary min-w-[88px]">Close</button>
   </div>
  </Modal>
 )
}

/* ---------------------------------- Main Component ---------------------------------- */

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

 /* ------------------------------ Data Loading ------------------------------ */

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
   setError(e.response?.data?.detail || 'Failed to load Agent list')
  } finally {
   setLoading(false)
  }
 }

 useEffect(() => {
  if (authChecked && isAdmin) fetchAgents()
 }, [authChecked, isAdmin])

 /* ------------------------------ Actions ------------------------------ */

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
   setFormError('Please select at least one permission')
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
   setFormError(e.response?.data?.detail || 'Operation failed, please try again')
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
   setConfirmError(e.response?.data?.detail || 'Failed to rotate, please try again')
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
   setConfirmError(e.response?.data?.detail || 'Failed to delete, please try again')
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
   /* clipboard ignore if unavailable */
  }
 }

 /* ------------------------------ Derived Data ------------------------------ */

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
  { label: 'Total Agents', value: agents.length, icon: Bot, tone: 'bg-gray-50 text-gray-600' },
  { label: 'Active', value: agents.filter(a => a.is_active).length, icon: Activity, tone: 'bg-gray-50 text-gray-600' },
  { label: 'Active in 7 Days', value: agents.filter(a => a.last_used_at && Date.now() - new Date(a.last_used_at).getTime() < 7 * 86400_000).length, icon: Clock, tone: 'bg-gray-50 text-gray-600' },
 ], [agents])

 /* ------------------------------ Render ------------------------------ */

 if (!authChecked || (authChecked && !isAdmin)) {
  return (
   <div className="flex h-64 items-center justify-center gap-3 text-gray-400">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className="text-sm">Verifying permissions...</span>
   </div>
  )
 }

 return (
  <div className="mx-auto max-w-7xl space-y-6">
   {/* Header */}
   <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
     <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 text-white shadow-lg shadow-primary-500/25">
      <ShieldCheck className="h-6 w-6" />
     </div>
     <div>
      <h1 className="text-xl font-bold text-gray-900">Agent Management</h1>
      <p className="text-sm text-gray-500">Manage Agent accounts, API Keys and access permissions for the platform</p>
     </div>
    </div>
    <div className="flex items-center gap-2 self-start sm:self-auto">
     <button onClick={() => setGuide({ open: true, agent: null })} className="btn-secondary">
      <BookOpen className="mr-1.5 h-4 w-4" />
      Guide
     </button>
     <button onClick={() => setSkillOpen(true)} className="btn-secondary">
      <GraduationCap className="mr-1.5 h-4 w-4" />
      Skill Template
     </button>
     <button onClick={openCreate} className="btn-primary shadow-sm shadow-primary-500/25">
      <Plus className="mr-1.5 h-4 w-4" />
      New Agent
     </button>
    </div>
   </div>

   {/* Global Error */}
   {error && (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
     <div className="flex items-center gap-2 text-sm text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {error}
     </div>
     <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
    </div>
   )}

   {/* Stats Cards */}
   <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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

   {/* Toolbar */}
   <div className="card">
    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
     <div className="relative sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
       value={search}
       onChange={e => setSearch(e.target.value)}
       placeholder="Search name, display name or type..."
       className="input pl-9"
      />
     </div>
     <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      {([['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']] as const).map(([v, label]) => (
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

    {/* Table */}
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
       <p className="font-medium text-gray-900">{agents.length === 0 ? 'No Agents Yet' : 'No matching results'}</p>
       <p className="mt-1 text-sm text-gray-500">
        {agents.length === 0 ? 'Create the first Agent to connect your AI assistant' : 'Try adjusting search keywords or filters'}
       </p>
      </div>
      {agents.length === 0 && (
       <button onClick={openCreate} className="btn-primary mt-2">
        <Plus className="mr-1.5 h-4 w-4" />New Agent
       </button>
      )}
     </div>
    ) : (
     <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[860px] text-left text-sm">
       <thead>
        <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold uppercase tracking-wider text-gray-500">
         <th className="px-5 py-3.5">Agent</th>
         <th className="px-4 py-3.5">Type</th>
         <th className="px-4 py-3.5">Permissions</th>
         <th className="px-4 py-3.5">Status</th>
         <th className="px-4 py-3.5">Last Active</th>
         <th className="px-5 py-3.5 text-right">Actions</th>
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
            {a.is_active ? 'Active' : 'Inactive'}
           </span>
          </td>
          <td className="px-4 py-4">
           <span className={clsx('text-xs', a.last_used_at ? 'text-gray-600' : 'italic text-gray-400')}>
            {timeAgo(a.last_used_at)}
           </span>
          </td>
          <td className="px-5 py-4">
           <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
            <button onClick={() => openEdit(a)} title="Edit" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600">
             <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setGuide({ open: true, agent: a })} title="Guide" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-violet-50 hover:text-violet-600">
             <BookOpen className="h-4 w-4" />
            </button>
            <button onClick={() => { setConfirmError(''); setRotateTarget(a) }} title="Rotate API Key" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-amber-50 hover:text-amber-600">
             <KeyRound className="h-4 w-4" />
            </button>
            <button onClick={() => { setConfirmError(''); setDeleteTarget(a) }} title="Delete" className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600">
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

    {/* Table Footer Stats */}
    {!loading && filtered.length > 0 && (
     <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
      Total {agents.length} agents, showing {filtered.length} </div>
    )}
   </div>

   {/* ------------------------- Create / Edit Modal ------------------------- */}
   {dialog && (
    <Modal onClose={() => setDialog(null)} wide>
     <ModalHeader
      icon={dialog === 'create' ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
      title={dialog === 'create' ? 'New Agent' : `Edit · ${editing?.display_name}`}
      desc={dialog === 'create' ? 'A one-time API Key will be generated after creation for Agent to connect to the platform' : 'Changes take effect immediately, API Key remains unchanged'}
      onClose={() => setDialog(null)}
     />

     <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-6 overflow-y-auto px-6 py-5 scrollbar-thin">
       {/* Basic Info */}
       <section>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Basic Info</h4>
        <div className="grid gap-4 sm:grid-cols-2">
         <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
           Name <span className="text-red-500">*</span>
          </span>
          <input
           required
           disabled={dialog === 'edit'}
           value={form.name}
           onChange={e => setForm({ ...form, name: e.target.value })}
           placeholder="my-agent-01"
           className="input font-mono disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          />
          <span className="mt-1 block text-xs text-gray-400">{dialog === 'edit' ? 'Cannot be changed after creation' : 'Unique identifier, use lowercase letters and hyphens'}</span>
         </label>
         <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
           Display Name <span className="text-red-500">*</span>
          </span>
          <input
           required
           value={form.display_name}
           onChange={e => setForm({ ...form, display_name: e.target.value })}
           placeholder="My Server Agent"
           className="input"
          />
         </label>
        </div>
        <label className="mt-4 block">
         <span className="mb-1.5 block text-sm font-medium text-gray-700">Description</span>
         <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={2}
          placeholder="Purpose of this machine, owner, etc. (optional)"
          className="input resize-none"
         />
        </label>
       </section>

       {/* Permissions */}
       <section>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Permissions</h4>
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
           Readable Agent List
          </span>
          <input
           value={form.readable_agent_ids.join(', ')}
           onChange={e => setForm({ ...form, readable_agent_ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
           placeholder="codex, claude-code"
           className="input font-mono"
          />
          <span className="mt-1.5 block text-xs text-cyan-700/70">Separate multiple Agent names with commas</span>
         </label>
        )}
       </section>

       {/* ActiveStatus */}
       <section className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
        <div>
         <div className="text-sm font-medium text-gray-900">Enable this Agent</div>
         <div className="mt-0.5 text-xs text-gray-500">Disabling will immediately invalidate this Agent's API Key</div>
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

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-6 py-4">
       <button type="button" onClick={() => setDialog(null)} className="btn-secondary">Cancel</button>
       <button type="submit" disabled={submitting} className="btn-primary min-w-[96px]">
        {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : dialog === 'create' ? 'Create & Generate Key' : 'Save Changes'}
       </button>
      </div>
     </form>
    </Modal>
   )}

   {/* ------------------------- Rotate Key Confirm Modal ------------------------- */}
   {rotateTarget && (
    <Modal onClose={() => setRotateTarget(null)}>
     <ModalHeader
      icon={<KeyRound className="h-5 w-5" />}
      title="Rotate API Key"
      desc={`${rotateTarget.display_name}(${rotateTarget.name})`}
      onClose={() => setRotateTarget(null)}
     />
     <div className="space-y-4 px-6 py-5">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
       <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
       <div className="space-y-1 text-sm text-amber-800">
        <p className="font-medium">This action cannot be undone</p>
        <p className="text-amber-700/80">The old Key will be invalidated immediately after rotation, and all connections using the old Key will be interrupted. The new Key is shown only once at generation.</p>
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
      <button onClick={() => setRotateTarget(null)} className="btn-secondary">Cancel</button>
      <button onClick={handleRotate} disabled={submitting} className="btn-danger min-w-[110px]">
       {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm Rotate'}
      </button>
     </div>
    </Modal>
   )}

   {/* ------------------------- Delete Confirm Modal ------------------------- */}
   {deleteTarget && (
    <Modal onClose={() => setDeleteTarget(null)}>
     <ModalHeader
      icon={<Ban className="h-5 w-5" />}
      title="Delete Agent"
      desc={`${deleteTarget.display_name}(${deleteTarget.name})`}
      onClose={() => setDeleteTarget(null)}
     />
     <div className="space-y-4 px-6 py-5">
      <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
       <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
       <div className="space-y-1 text-sm text-red-800">
        <p className="font-medium">Are you sure you want to delete this Agent?</p>
        <p className="text-red-700/80">The API Key for this Agent will be permanently invalidated and cannot be recovered. Historical logs will be retained.</p>
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
      <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
      <button onClick={handleDelete} disabled={submitting} className="btn-danger min-w-[110px]">
       {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm Delete'}
      </button>
     </div>
    </Modal>
   )}

   {/* ------------------------- API Key Display Modal ------------------------- */}
   {keyDialog && (
    <Modal onClose={() => setKeyDialog(null)}>
     <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
       <Check className="h-7 w-7" strokeWidth={2.5} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">API Key Generated</h3>
      <p className="mt-1 text-sm text-gray-500">
       For <span className="font-medium text-gray-700">{keyDialog.agentName}</span> a new API Key has been generated
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
         {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
        </button>
       </div>
       <code className="block select-all break-all font-mono text-sm text-gray-900">{keyDialog.key}</code>
      </div>

      <div className="mt-4 w-full text-left">
       <CopyBlock
        label={`Agent connection command (${keyDialog.agentName} — includes real Key)`}
        code={`claude mcp add agent-station --transport sse \\\n "${MCP_SSE_URL}?api_key=${keyDialog.key}"`}
       />
      </div>

      <div className="mt-4 flex w-full items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-left">
       <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
       <p className="text-xs leading-relaxed text-amber-800">
        Please copy and save it immediately, <span className="font-semibold">it cannot be viewed again after closing</span>.
        If lost, you can only rotate again. The connection command above already contains the real Key and can be sent directly to the agent.
       </p>
      </div>

      <button onClick={() => setKeyDialog(null)} className="btn-primary mt-6 w-full">
       I have saved it, close
      </button>
     </div>
    </Modal>
   )}

   {/* ------------------------- MCP Guide Modal ------------------------- */}
   {guide.open && (
    <GuideModal agent={guide.agent} onClose={() => setGuide({ open: false, agent: null })} />
   )}

   {/* ------------------------- Skill Template Modal ------------------------- */}
   {skillOpen && <SkillTemplateModal onClose={() => setSkillOpen(false)} />}
  </div>
 )
}
