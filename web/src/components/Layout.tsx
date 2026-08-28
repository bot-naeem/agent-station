import { Outlet, Link, useLocation } from '@tanstack/react-router'
import { LayoutDashboard, List, Menu, X, Shield, FileText, KanbanSquare } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'

const navigation = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '日志列表', href: '/logs', icon: List },
  { name: '博客', href: '/blog', icon: FileText },
  { name: '任务中心', href: '/tasks', icon: KanbanSquare },
  { name: 'Agent 管理', href: '/agents', icon: Shield },
]

export function Layout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLogin = location.pathname === '/login'

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
                <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
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
                  <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
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
              </ul>
            </nav>
          </div>
        </aside>
      )}

      {/* 主内容区 */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900">
            {navigation.find((n) => location.pathname === n.href || location.pathname.startsWith(n.href + '/'))?.name || 'Agent Station'}
          </h1>
        </header>
        <main className="py-6 px-4 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}