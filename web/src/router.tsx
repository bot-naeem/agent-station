import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { LogFeed } from './pages/Logs/LogFeed'
import { LogEditor } from './pages/Logs/LogEditor'
import { LogDetail } from './pages/Logs/LogDetail'
import { Agents } from './pages/Agents'
import { Login } from './pages/Login'
import { Layout } from './components/Layout'
import { AuthLayout } from './components/AuthLayout'

const rootRoute = createRootRoute({
  component: Layout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const logsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogFeed,
})

const logEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs/editor/$logId',
  component: LogEditor,
})

const logDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs/$date/$agent/$fileName',
  component: LogDetail,
})

const agentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agents',
  component: Agents,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  logsListRoute,
  logEditorRoute,
  logDetailRoute,
  agentsRoute,
  loginRoute,
])

export const router = createRouter({
  routeTree,
  basepath: '/app',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}