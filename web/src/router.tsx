import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { LogsList } from './pages/Logs/LogsList'
import { LogEditor } from './pages/Logs/LogEditor'
import { LogDetail } from './pages/Logs/LogDetail'
import { Agents } from './pages/Agents'
import { Login } from './pages/Login'
import { BlogsList, BlogDetail, BlogEditor } from './pages/Blogs'
import { TaskCenter } from './pages/Tasks'
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
  component: LogsList,
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

const blogsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog',
  component: BlogsList,
})

const blogDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/$slug',
  component: BlogDetail,
})

const blogEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/editor/$blogId',
  component: BlogEditor,
})

const blogEditorNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/editor/new',
  component: BlogEditor,
})

const taskCenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  component: TaskCenter,
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
  blogsListRoute,
  blogDetailRoute,
  blogEditorRoute,
  blogEditorNewRoute,
  taskCenterRoute,
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