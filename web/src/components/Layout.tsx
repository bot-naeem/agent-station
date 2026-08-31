import { Outlet, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, List, Menu, X, Shield, FileText, KanbanSquare, LogIn, LogOut, KeyRound, User, ChevronDown } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { clsx } from 'clsx'
import { authApi } from '../services/api'

const navigation = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '动态', href: '/logs', icon: List },
  { name: '博客', href: '/blog', icon: FileText },
  { name: '任务', href: '/tasks', icon: KanbanSquare },
  { name: 'Agents', href: '/agents', icon: Shield },
]

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('请填写所有字段')
      return
    }
    if (newPassword.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次新密码不一致')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword({ old_password: oldPassword, new_password: newPassword })
      setSuccess(true)
      setTimeout(() => onClose(), 1200)
    } catch (err: any) {
      setError(err.response?.data?.detail || '修改失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">修改密码</h3>
              <p className="text-xs text-gray-500">仅人类管理员</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6 pt-2">
          {error && <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">修改成功</div>}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-gray-600">原密码</span>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input" placeholder="当前密码" autoComplete="current-password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-gray-600">新密码</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" placeholder="至少 6 位" autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-gray-600">确认新密码</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="再次输入" autoComplete="new-password" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">取消</button>
            <button type="submit" disabled={loading} className="btn-primary min-w-[88px]">
              {loading ? '提交中…' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function useClickOutside(ref: React.RefObject<HTMLElement>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [ref, onClose, enabled])
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<{ username: string; display_name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  const sidebarMenuRef = useRef<HTMLDivElement>(null)

  const isLogin = location.pathname === '/login'

  useClickOutside(headerMenuRef, () => setHeaderMenuOpen(false), headerMenuOpen)
  useClickOutside(sidebarMenuRef, () => setSidebarMenuOpen(false), sidebarMenuOpen)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const me = await authApi.me()
        if (!cancelled) setUser({ username: me.username, display_name: me.display_name })
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }
    if (!isLogin) check()
    else setAuthChecked(true)
    return () => { cancelled = true }
  }, [isLogin, location.pathname])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch { /* ignore */ }
    setUser(null)
    setHeaderMenuOpen(false)
    setSidebarMenuOpen(false)
    navigate({ to: '/login' })
  }

  if (isLogin) {
    return (
      <div className="min-h-screen bg-white">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 侧边栏 - 桌面端 */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-[220px] lg:flex-col">
        <div className="flex grow flex-col gap-y-6 border-r border-gray-100 bg-white px-4 pb-4">
          <div className="flex h-[60px] shrink-0 items-center px-2">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white">
                <div className="h-3 w-3 rounded-sm border-[1.5px] border-white/90" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-gray-900">Agent Station</span>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-6">
              <li>
                <ul role="list" className="space-y-1">
                  {navigation.map((item) => {
                    const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={clsx(
                            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                            active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <item.icon className={clsx('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-gray-400')} />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                {authChecked && user ? (
                  <div ref={sidebarMenuRef} className="relative">
                    <button
                      onClick={() => setSidebarMenuOpen((v) => !v)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 text-left hover:bg-white hover:border-gray-200 transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                        {user.display_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-none text-gray-900">{user.display_name}</div>
                        <div className="truncate text-xs text-gray-500">@{user.username}</div>
                      </div>
                      <ChevronDown className={clsx('h-4 w-4 text-gray-400 transition-transform', sidebarMenuOpen && 'rotate-180')} />
                    </button>
                    {sidebarMenuOpen && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
                        <div className="px-3 py-2">
                          <div className="text-sm font-medium text-gray-900">{user.display_name}</div>
                          <div className="text-xs text-gray-500">@{user.username}</div>
                        </div>
                        <div className="my-1 h-px bg-gray-100" />
                        <button onClick={() => { setSidebarMenuOpen(false); setShowPwdModal(true) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <KeyRound className="h-4 w-4 text-gray-400" /> 修改密码
                        </button>
                        <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                          <LogOut className="h-4 w-4" /> 退出登录
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link to="/login" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black">
                    <LogIn className="h-4 w-4" /> 登录
                  </Link>
                )}
              </li>
            </ul>
          </nav>
          <div className="px-2 text-[11px] leading-relaxed text-gray-400">
            自托管 · 极简
          </div>
        </div>
      </aside>

      {/* 移动端菜单按钮 */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* 移动端侧边栏 */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
      )}
      {mobileMenuOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-gray-100">
          <div className="flex h-full flex-col gap-y-6 px-4 pb-4">
            <div className="flex h-[60px] shrink-0 items-center px-2">
              <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white">
                  <div className="h-3 w-3 rounded-sm border-[1.5px] border-white/90" />
                </div>
                <span className="text-[15px] font-semibold tracking-tight">Agent Station</span>
              </Link>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={clsx(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium',
                          active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <item.icon className={clsx('h-[18px] w-[18px]', active ? 'text-white' : 'text-gray-400')} />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-auto">
                {authChecked && user ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                        {user.display_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{user.display_name}</div>
                        <div className="truncate text-xs text-gray-500">@{user.username}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <button onClick={() => { setMobileMenuOpen(false); setShowPwdModal(true) }} className="rounded-lg bg-white px-2 py-1.5 text-xs font-medium ring-1 ring-gray-200">修改密码</button>
                      <button onClick={() => { setMobileMenuOpen(false); handleLogout() }} className="rounded-lg bg-white px-2 py-1.5 text-xs font-medium ring-1 ring-gray-200">退出</button>
                    </div>
                  </div>
                ) : (
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex w-full justify-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white">登录</Link>
                )}
              </div>
            </nav>
          </div>
        </aside>
      )}

      {/* 主内容区 */}
      <div className="lg:pl-[220px]">
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-4 border-b border-gray-100 bg-white/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:px-6">
          <h1 className="flex-1 pl-10 text-sm font-medium tracking-tight text-gray-900 lg:pl-0">
            {navigation.find((n) => location.pathname === n.href || location.pathname.startsWith(n.href + '/'))?.name || 'Agent Station'}
          </h1>
          <div className="flex items-center gap-2">
            {authChecked && user ? (
              <div ref={headerMenuRef} className="relative">
                <button
                  onClick={() => setHeaderMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white pl-1 pr-3 py-1 hover:bg-gray-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white">
                    {user.display_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden text-sm font-medium text-gray-700 sm:inline">{user.display_name}</span>
                  <ChevronDown className={clsx('h-4 w-4 text-gray-400 transition-transform', headerMenuOpen && 'rotate-180')} />
                </button>
                {headerMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900">{user.display_name}</div>
                      <div className="text-xs text-gray-500">@{user.username}</div>
                    </div>
                    <div className="my-1 h-px bg-gray-100" />
                    <button onClick={() => { setHeaderMenuOpen(false); setShowPwdModal(true) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <KeyRound className="h-4 w-4 text-gray-400" /> 修改密码
                    </button>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> 退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black">
                <LogIn className="h-4 w-4" /> 登录
              </Link>
            )}
          </div>
        </header>
        <main className="px-4 py-6 lg:px-6">
          <Outlet />
        </main>
      </div>

      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}
    </div>
  )
}
