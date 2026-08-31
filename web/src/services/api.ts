import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true, // 重要：允许发送 Cookie
})

// 请求拦截器 - 不再需要手动添加 API Key，改用 Cookie 认证
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // 未授权，清除本地状态、跳转登录
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
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
  agent_name?: string | null
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

export interface MarkdownStats {
  total_logs: number
  total_tokens: number
  total_chars: number
  by_agent: Record<string, number>
  by_date: Record<string, number>
  top_tags: Array<{ tag: string; count: number }>
}

export interface Task {
  id: string
  agent_id: string
  agent_name: string | null
  title: string
  status: '待办' | '进行中' | '阻塞' | '挂起' | '完成' | '废弃'
  detail: string | null
  tags: string[]
  project: string | null
  result: string | null
  status_history: Array<{ from: string | null; to: string; at: string }>
  created_at: string
  updated_at: string
}

export interface TaskListParams {
  status?: string
  agent_id?: string
  project?: string
  tag?: string
  page?: number
  page_size?: number
}

export interface TaskCreate {
  title: string
  detail?: string
  status?: '待办' | '进行中' | '阻塞' | '挂起' | '完成' | '废弃'
  tags?: string[]
  project?: string
  agent_id?: string
}

export interface TaskCloseRequest {
  id?: string
  title?: string
  status: '完成' | '废弃'
  result?: string
}

export interface TaskListResponse {
  items: Task[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// API 方法 - 所有方法直接返回数据（已解包 AxiosResponse）
export const markdownApi = {
  create: async (data: { content: string; session_id?: string; agent_type: string; log_date?: string; front_matter?: any }) =>
    (await api.post<MarkdownLog>('/markdown', data)).data,

  list: async (params: MarkdownLogSearchParams) =>
    (await api.get<PaginatedResponse<MarkdownLog>>('/markdown', { params })).data,

  stats: async (start_date?: string, end_date?: string) =>
    (await api.get<MarkdownStats>('/markdown/stats', { params: { start_date, end_date } })).data,

  get: async (id: string) =>
    (await api.get<MarkdownLog>(`/markdown/${id}`)).data,

  update: async (id: string, data: Partial<Pick<MarkdownLog, 'title' | 'summary' | 'content'> & { tags?: string[] }>) =>
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

export const healthApi = {
  check: async () =>
    (await api.get('/health/public')).data,
}

export const agentApi = {
  list: async (params?: { page?: number; page_size?: number; is_active?: boolean }) =>
    (await api.get<PaginatedResponse<AgentResponse>>('/agents', { params })).data,

  listReadable: async (params?: { page?: number; page_size?: number }) =>
    (await api.get<PaginatedResponse<AgentResponse>>('/agents/readable', { params })).data,

  get: async (id: string) =>
    (await api.get<AgentResponse>(`/agents/${id}`)).data,

  me: async () =>
    (await api.get<AgentResponse>(`/agents/me`)).data,

  create: async (data: AgentCreate) =>
    (await api.post<AgentResponse>('/agents', data)).data,

  update: async (id: string, data: AgentUpdate) =>
    (await api.patch<AgentResponse>(`/agents/${id}`, data)).data,

  updatePermissions: async (id: string, data: { permissions: string[]; readable_agent_ids?: string[] }) =>
    (await api.patch<AgentResponse>(`/agents/${id}/permissions`, data)).data,

  rotateKey: async (id: string) =>
    (await api.post<AgentResponse>(`/agents/${id}/rotate-key`)).data,

  delete: async (id: string) => {
    await api.delete(`/agents/${id}`)
  },
}

export interface AgentResponse {
  id: string
  name: string
  display_name: string
  description: string | null
  agent_type: string
  permissions: string[]
  readable_agent_ids: string[]
  is_active: boolean
  created_at: string
  last_used_at: string | null
  api_key?: string
}

export interface AgentCreate {
  name: string
  display_name: string
  description?: string
  permissions: string[]
  readable_agent_ids: string[]
  is_active: boolean
}

export interface AgentUpdate {
  display_name?: string
  description?: string
  agent_type?: string
  permissions?: string[]
  readable_agent_ids?: string[]
  is_active?: boolean
}

export interface BlogPost {
  id: string
  agent_id: string
  agent_name: string | null
  title: string
  slug: string
  summary: string | null
  cover_image: string | null
  status: 'draft' | 'published' | 'archived'
  category: string | null
  tags: string[]
  published_at: string | null
  created_at: string
  updated_at: string
  content?: string
  front_matter?: Record<string, any>
}

export interface BlogPostListResponse {
  items: BlogPost[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface BlogStats {
  total_posts: number
  published_posts: number
  draft_posts: number
  by_category: Record<string, number>
  by_agent: Record<string, number>
  top_tags: Array<{ tag: string; count: number }>
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: AdminUserResponse
  token: string
}

export interface AdminUserResponse {
  id: string
  username: string
  display_name: string
  email: string | null
  is_superuser: boolean
  is_active: boolean
}

export const authApi = {
  login: async (data: LoginRequest) =>
    (await api.post<{ user: AdminUserResponse; token: string }>('/auth/login', data)).data,

  logout: async () =>
    (await api.post('/auth/logout')).data,

  me: async () =>
    (await api.get<{ id: string; username: string; display_name: string; email: string | null; is_superuser: boolean; is_active: boolean }>('/auth/me')).data,

  changePassword: async (data: { old_password: string; new_password: string }) =>
    (await api.post('/auth/change-password', data)).data,
}

export const tasksApi = {
  create: async (data: TaskCreate) =>
    (await api.post<Task>('/tasks', data)).data,

  list: async (params: TaskListParams) =>
    (await api.get<TaskListResponse>('/tasks', { params })).data,

  get: async (id: string) =>
    (await api.get<Task>(`/tasks/${id}`)).data,

  update: async (id: string, data: Partial<TaskCreate & { result?: string }>) =>
    (await api.patch<Task>(`/tasks/${id}`, data)).data,

  close: async (id: string, data: TaskCloseRequest) =>
    (await api.post<Task>('/tasks/close', { ...data, id })).data,

  delete: async (id: string) => {
    await api.delete(`/tasks/${id}`)
  },
}

export const blogApi = {
  create: async (data: {
    title: string
    slug?: string
    summary?: string
    cover_image?: string
    category?: string
    tags?: string[]
    status?: 'draft' | 'published' | 'archived'
    content: string
  }) =>
    (await api.post<BlogPost>('/blog', data)).data,

  list: async (params: {
    page?: number
    page_size?: number
    category?: string
    tag?: string
    status?: 'draft' | 'published' | 'archived'
    query?: string
    agent_name?: string
  }) =>
    (await api.get<BlogPostListResponse>('/blog', { params })).data,

  stats: async () =>
    (await api.get<BlogStats>('/blog/stats')).data,

  get: async (identifier: string) =>
    (await api.get<BlogPost>(`/blog/${identifier}`)).data,

  update: async (id: string, data: Partial<{
    title: string
    slug: string
    summary: string
    cover_image: string
    category: string
    tags: string[]
    status: 'draft' | 'published' | 'archived'
    content: string
  }>) =>
    (await api.put<BlogPost>(`/blog/${id}`, data)).data,

  delete: async (id: string) => {
    await api.delete(`/blog/${id}`)
  },
}