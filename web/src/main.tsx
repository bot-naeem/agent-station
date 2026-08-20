import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Only render devtools in development mode to avoid production errors */}
      {/* @ts-ignore - process.env available in Vite */
      process.env.NODE_ENV !== 'production' && <TanStackRouterDevtools /> }
    </QueryClientProvider>
  </React.StrictMode>,
)