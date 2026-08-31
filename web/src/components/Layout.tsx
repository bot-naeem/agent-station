import { Outlet, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, List, Menu, X, Shield, FileText, KanbanSquare, LogIn, LogOut, KeyRound, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { authApi } from '../services/api'

const navigation = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '日志列表', href: '/logs', icon: List },
  { name: '博客', href: '/blog', icon: FileText },
  { name: '任务中心', href: '/tasks', icon: KanbanSquare },
  { name: 'Agent 管理', href: '/agents', icon: Shield },
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
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/5">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">修改密码</h3>
              <p className="text-xs text-gray-500">仅人类管理员可修改</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">修改成功</div>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">原密码</span>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input w-full" placeholder="当前密码" autoComplete="current-password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">新密码</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input w-full" placeholder="至少 6 位" autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">确认新密码</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input w-full" placeholder="再次输入新密码" autoComplete="new-password" />
          </label>
          <div className="flex justify-end gap-3 pt-2">
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

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<{ username: string; display_name: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showPwdModal, setShowPwdModal] = useState(false)

  const isLogin = location.pathname === '/login'

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
    navigate({ to: '/login' })
  }

  if (isLogin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 侧边栏 - 桌面端 */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <Link to="/" className="flex items-center gap-2">
              <svg className="h-8 w-8 text-primary-600" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="6" fill="currentColor"/>
                <path d="M8 12h16M8 16h12M8 20h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span className="text-xl font-bold text-gray-900">Agent Station</span>
            </Link>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={clsx(
                          'group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold',
                          location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="rounded-xl bg-gray-50 p-3">
                  {authChecked && user ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                          {user.display_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900">{user.display_name}</div>
                          <div className="truncate text-xs text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setShowPwdModal(true)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-900 hover:text-white">
                          <KeyRound className="h-3.5 w-3.5" /> 改密码
                        </button>
                        <button onClick={handleLogout} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-red-50 hover:text-red-600 hover:ring-red-200">
                          <LogOut className="h-3.5 w-3.5" /> 退出
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Link to="/login" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
                      <LogIn className="h-4 w-4" /> 登录
                    </Link>
                  )}
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* 移动端菜单按钮 */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="btn-primary p-2 rounded-lg shadow-lg"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* 移动端侧边栏 */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
      )}
      {mobileMenuOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform">
          <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <svg className="h-8 w-8 text-primary-600" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="6" fill="currentColor"/>
                  <path d="M8 12h16M8 16h12M8 20h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              <span className="text-xl font-bold text-gray-900">Agent Station</span>
              </Link>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={clsx(
                            'group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold',
                            location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="mt-auto">
                  <div className="rounded-xl bg-gray-50 p-3">
                    {authChecked && user ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                            {user.display_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900">{user.display_name}</div>
                            <div className="truncate text-xs text-gray-500">@{user.username}</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => { setMobileMenuOpen(false); setShowPwdModal(true) }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                            <KeyRound className="h-3.5 w-3.5" /> 改密码
                          </button>
                          <button onClick={() => { setMobileMenuOpen(false); handleLogout() }} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                            <LogOut className="h-3.5 w-3.5" /> 退出
                          </button>
                        </div>
                      </div>
                    ) : (
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white">
                        <LogIn className="h-4 w-4" /> 登录
                      </Link>
                    )}
                  </div>
                </li>
              </ul>
            </nav>
          </div>
        </aside>
      )}

      {/* 主内容区 */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:px-8">
          <h1 className="flex-1 text-lg font-semibold text-gray-900">
            {navigation.find((n) => location.pathname === n.href || location.pathname.startsWith(n.href + '/'))?.name || 'Agent Station'}
          </h1>
          <div className="flex items-center gap-2">
            {authChecked && user ? (
              <>
                <span className="hidden items-center gap-1.5 text-sm text-gray-600 sm:inline-flex">
                  <User className="h-4 w-4 text-gray-400" /> {user.display_name}
                </span>
                <button onClick={() => setShowPwdModal(true)} className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 sm:ml-2">
                  <KeyRound className="h-4 w-4" /> 修改密码
                </button>
                <button onClick={handleLogout} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black">
                  <LogOut className="h-4 w-4" /> 退出
                </button>
              </>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
                <LogIn className="h-4 w-4" /> 登录
              </Link>
            )}
          </div>
        </header>
        <main className="py-6 px-4 lg:px-8">
          <Outlet />
        </main>
      </div>

      {showPwdModal && <ChangePasswordModal onClose={() => setShowPwdModal(false)} />}
    </div>
  )
}
