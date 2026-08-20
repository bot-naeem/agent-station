import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://codingfamily.online/api/v1'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// 请求拦截器 - 添加 API Key
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const apiKey = localStorage.getItem('api_key') || import.meta.env.VITE_API_KEY
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // 未授权，可选：清除本地存储、跳转登录
      console.error('API Key invalid or missing')
    }
    return Promise.reject(error)
  }
)

// 类型定义
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface MarkdownLog {
  id: string
  session_id: string | null
  agent_type: string
  log_date: string
  file_path: string
  file_hash: string | null
  front_matter: Record<string, any>
  title: string | null
  summary: string | null
  tokens_estimate: number | null
  created_at: string
  updated_at: string
  content?: string
}

export interface MarkdownLogSearchParams {
  agent_type?: string
  start_date?: string
  end_date?: string
  tags?: string[]
  query?: string
  session_id?: string
  page?: number
  page_size?: number
}

export interface MarkdownCalendarItem {
  date: string
  count: number
  agents: Record<string, number>
}

export interface MarkdownStats {
  total_logs: number
  total_tokens: number
  total_chars: number
  by_agent: Record<string, number>
  by_date: Record<string, number>
  top_tags: Array<{ tag: string; count: number }>
}

export interface Todo {
  id: string
  session_id: string | null
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'done'
  priority: number
  meta_data: Record<string, any>
  created_at: string
  updated_at: string
}

export interface TodoListParams {
  session_id?: string
  status?: string
  page?: number
  page_size?: number
}

export interface RAGSource {
  markdown_log_id: string
  session_id: string | null
  agent_type: string
  log_date: string
  file_path: string
  title: string | null
  chunk_content: string
  score: number
}

export interface RAGQueryResponse {
  answer: string
  sources: RAGSource[]
  query: string
}

export interface RAGChatRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  session_id?: string
  agent_type?: string
  top_k?: number
  temperature?: number
}

// API 方法 - 所有方法直接返回数据（已解包 AxiosResponse）
export const markdownApi = {
  create: async (data: { content: string; session_id?: string; agent_type: string; log_date?: string; front_matter?: any }) =>
    (await api.post<MarkdownLog>('/markdown', data)).data,

  list: async (params: MarkdownLogSearchParams) =>
    (await api.get<PaginatedResponse<MarkdownLog>>('/markdown', { params })).data,

  calendar: async (year: number, month: number) =>
    (await api.get<MarkdownCalendarItem[]>('/markdown/calendar', { params: { year, month } })).data,

  stats: async (start_date?: string, end_date?: string) =>
    (await api.get<MarkdownStats>('/markdown/stats', { params: { start_date, end_date } })).data,

  get: async (id: string) =>
    (await api.get<MarkdownLog>(`/markdown/${id}`)).data,

  update: async (id: string, data: Partial<MarkdownLog>) =>
    (await api.put<MarkdownLog>(`/markdown/${id}`, data)).data,

  delete: async (id: string) => {
    await api.delete(`/markdown/${id}`)
  },

  batchImport: async (files: File[]) => {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return (await api.post('/markdown/batch-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data
  },
}

export const todoApi = {
  create: async (data: { session_id?: string; title: string; description?: string; priority?: number; meta_data?: any }) =>
    (await api.post<Todo>('/todos', data)).data,

  list: async (params: TodoListParams) =>
    (await api.get<PaginatedResponse<Todo>>('/todos', { params })).data,

  get: async (id: string) =>
    (await api.get<Todo>(`/todos/${id}`)).data,

  update: async (id: string, data: Partial<Todo>) =>
    (await api.put<Todo>(`/todos/${id}`, data)).data,

  batchUpdate: async (ids: string[], status?: string, priority?: number) =>
    (await api.patch('/todos/batch', { ids, status, priority })).data,

  delete: async (id: string) => {
    await api.delete(`/todos/${id}`)
  },
}

export const ragApi = {
  query: async (data: { query: string; session_id?: string; agent_type?: string; top_k?: number; score_threshold?: number; use_mmr?: boolean }) =>
    (await api.post<RAGQueryResponse>('/rag/query', data)).data,

  chat: async (data: RAGChatRequest) =>
    (await api.post<{ answer: string; sources: RAGSource[] }>('/rag/chat', data)).data,

  stats: async () =>
    (await api.get('/rag/stats')).data,
}

export const healthApi = {
  check: async () =>
    (await api.get('/health/public')).data,
}