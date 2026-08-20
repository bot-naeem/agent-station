from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class TodoCreate(BaseModel):
    session_id: Optional[UUID] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: int = Field(0, ge=0, le=10)
    meta_data: dict = Field(default_factory=dict)


class TodoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|done)$")
    priority: Optional[int] = Field(None, ge=0, le=10)
    meta_data: Optional[dict] = None


class TodoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: Optional[UUID]
    title: str
    description: Optional[str]
    status: str
    priority: int
    meta_data: dict
    created_at: datetime
    updated_at: datetime


class TodoListParams(BaseModel):
    session_id: Optional[UUID] = None
    status: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=200)


class TodoBatchUpdate(BaseModel):
    ids: list[UUID]
    status: Optional[str] = None
    priority: Optional[int] = None