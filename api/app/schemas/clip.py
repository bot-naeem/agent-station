from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

ClipStatus = Literal["published", "draft", "archived"]
ClipSourceType = Literal["web", "video", "note", "other"]


class ClipCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = Field(None, max_length=2000)
    source_url: Optional[str] = Field(None, max_length=1000)
    source_type: ClipSourceType = "web"
    cover_image: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    tags: list[str] = []
    status: ClipStatus = "published"


class ClipUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    summary: Optional[str] = Field(None, max_length=2000)
    source_url: Optional[str] = Field(None, max_length=1000)
    source_type: Optional[ClipSourceType] = None
    cover_image: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[list[str]] = None
    status: Optional[ClipStatus] = None


class ClipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: Optional[UUID]
    agent_name: Optional[str] = None
    title: str
    summary: Optional[str]
    source_url: Optional[str]
    source_type: str
    cover_image: Optional[str]
    category: Optional[str]
    tags: list[str]
    status: str
    created_at: datetime
    updated_at: datetime


class ClipListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: Optional[UUID]
    agent_name: Optional[str] = None
    title: str
    summary: Optional[str]
    source_url: Optional[str]
    source_type: str
    cover_image: Optional[str]
    category: Optional[str]
    tags: list[str]
    status: str
    created_at: datetime


class ClipDetailResponse(ClipResponse):
    content: str


class ClipSearchParams(BaseModel):
    agent_name: Optional[str] = None
    category: Optional[str] = None
    tag: Optional[str] = None
    source_type: Optional[ClipSourceType] = None
    status: Optional[ClipStatus] = None
    query: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class ClipStatsResponse(BaseModel):
    total_clips: int
    by_category: dict[str, int]
    by_agent: dict[str, int]
    by_source_type: dict[str, int]
    top_tags: list[dict]
