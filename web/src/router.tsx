import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { LogsCalendar } from './pages/Logs/LogsCalendar'
import { LogsList } from './pages/Logs/LogsList'
import { LogDetail } from './pages/Logs/LogDetail'
import { Chat } from './pages/RAG/Chat'
import { TodoBoard } from './pages/Todos/TodoBoard'
import { Timeline } from './pages/Sessions/Timeline'
import { Layout } from './components/Layout'

const rootRoute = createRootRoute({
  component: Layout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const logsCalendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsCalendar,
})

const logsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs/list',
  component: LogsList,
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

const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: Timeline,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  logsCalendarRoute,
  logsListRoute,
  logDetailRoute,
  ragRoute,
  todosRoute,
  timelineRoute,
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