"""Task schemas"""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    status: str = Field("待办", max_length=20)
    detail: Optional[str] = None
    tags: list[str] = []
    project: Optional[str] = None
    agent_id: Optional[UUID] = None  # 仅 admin 可用：指派给指定 Agent


class TaskUpdate(BaseModel):
    """部分更新：未传字段不动"""
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    status: Optional[str] = Field(None, max_length=20)
    detail: Optional[str] = None
    tags: Optional[list[str]] = None
    project: Optional[str] = None
    result: Optional[str] = None


class TaskStatusHistoryEntry(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    at: str


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    agent_id: Optional[UUID]
    title: str
    status: str
    detail: Optional[str] = None
    tags: list[Any] = []
    project: Optional[str] = None
    result: Optional[str] = None
    status_history: list[Any] = []
    created_at: datetime
    updated_at: datetime


class TaskCloseRequest(BaseModel):
    id: Optional[UUID] = None
    title: Optional[str] = None
    status: str = "完成"  # 完成 | 废弃
    result: Optional[str] = None
