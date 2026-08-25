import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { LogsList } from './pages/Logs/LogsList'
import { LogEditor } from './pages/Logs/LogEditor'
import { LogDetail } from './pages/Logs/LogDetail'
import { Chat } from './pages/RAG/Chat'
import { TodoBoard } from './pages/Todos/TodoBoard'
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

const ragRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rag',
  component: Chat,
})

const todosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/todos',
  component: TodoBoard,
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
  ragRoute,
  todosRoute,
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