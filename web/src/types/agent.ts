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

export interface AgentPermissionUpdate {
  permissions: string[]
  readable_agent_ids?: string[]
}

export const AGENT_PERMISSIONS = [
  'read_own',
  'read_all',
  'read_specific',
  'write_own',
  'admin',
] as const