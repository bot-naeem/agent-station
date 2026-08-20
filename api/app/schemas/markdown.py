from datetime import date, datetime
from uuid import UUID
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class MarkdownFrontMatter(BaseModel):
    session_id: Optional[str] = None
    agent_type: Optional[str] = None
    task_type: Optional[str] = None
    project: Optional[str] = None
    tags: list[str] = []
    status: Optional[str] = None
    tokens_used: Optional[int] = None
    duration_seconds: Optional[int] = None
    tools_used: list[str] = []
    related_files: list[str] = []
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class MarkdownLogCreate(BaseModel):
    content: str = Field(..., min_length=1)
    session_id: Optional[UUID] = None
    agent_type: Optional[str] = Field(None, max_length=50)
    log_date: Optional[date] = None
    front_matter: Optional[MarkdownFrontMatter] = None


class MarkdownLogUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[list[str]] = None


class MarkdownLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: Optional[UUID]
    agent_id: Optional[UUID]
    agent_type: str
    log_date: date
    file_path: str
    file_hash: Optional[str]
    front_matter: dict
    title: Optional[str]
    summary: Optional[str]
    tokens_estimate: Optional[int]
    created_at: datetime
    updated_at: datetime


class MarkdownLogListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: Optional[UUID]
    agent_id: Optional[UUID]
    agent_type: str
    log_date: date
    file_path: str
    title: Optional[str]
    summary: Optional[str]
    tokens_estimate: Optional[int]
    created_at: datetime


class MarkdownLogDetailResponse(MarkdownLogResponse):
    content: str
    agent_id: Optional[UUID] = None


class MarkdownLogSearchParams(BaseModel):
    agent_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    tags: Optional[list[str]] = None
    query: Optional[str] = None
    session_id: Optional[UUID] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class MarkdownCalendarResponse(BaseModel):
    date: date
    count: int
    agents: dict[str, int]


class MarkdownStatsResponse(BaseModel):
    total_logs: int
    total_tokens: int
    total_chars: int
    by_agent: dict[str, int]
    by_date: dict[str, int]
    top_tags: list[dict[str, int]]