"""Agent schemas for multi-agent RBAC"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    display_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    agent_type: Optional[str] = Field(None, max_length=100)
    permissions: List[str] = ["read_all", "write_own"]
    readable_agent_ids: List[str] = []
    is_active: bool = True


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    agent_type: Optional[str] = Field(None, max_length=100)
    permissions: Optional[List[str]] = None
    readable_agent_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AgentPermissionUpdate(BaseModel):
    permissions: List[str]
    readable_agent_ids: Optional[List[str]] = None


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    display_name: str
    description: Optional[str]
    agent_type: str
    permissions: List[str]
    readable_agent_ids: List[str]
    is_active: bool
    created_at: str
    last_used_at: Optional[str]
    api_key: Optional[str] = None  # Only on creation/rotation


class AgentListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    display_name: str
    description: Optional[str]
    agent_type: str
    permissions: List[str]
    readable_agent_ids: List[str]
    is_active: bool
    created_at: str
    last_used_at: Optional[str]