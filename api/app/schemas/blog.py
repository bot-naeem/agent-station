from datetime import date, datetime
from uuid import UUID
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from app.models.blog_post import BlogStatus


class BlogPostFrontMatter(BaseModel):
    category: Optional[str] = None
    tags: list[str] = []
    cover_image: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image: Optional[str] = None


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    summary: Optional[str] = Field(None, max_length=500)
    cover_image: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    tags: list[str] = []
    status: BlogStatus = BlogStatus.draft
    front_matter: Optional[BlogPostFrontMatter] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = None
    summary: Optional[str] = Field(None, max_length=500)
    cover_image: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[list[str]] = None
    status: Optional[BlogStatus] = None
    front_matter: Optional[BlogPostFrontMatter] = None


class BlogPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    title: str
    slug: str
    summary: Optional[str]
    cover_image: Optional[str]
    status: BlogStatus
    category: Optional[str]
    tags: list[str]
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class BlogPostListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    title: str
    slug: str
    summary: Optional[str]
    cover_image: Optional[str]
    status: BlogStatus
    category: Optional[str]
    tags: list[str]
    published_at: Optional[datetime]
    created_at: datetime


class BlogPostDetailResponse(BlogPostResponse):
    content: str
    front_matter: dict


class BlogPostSearchParams(BaseModel):
    agent_id: Optional[UUID] = None
    agent_name: Optional[str] = None
    category: Optional[str] = None
    tag: Optional[str] = None
    status: Optional[BlogStatus] = BlogStatus.published
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    query: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class BlogPostStatsResponse(BaseModel):
    total_posts: int
    published_posts: int
    draft_posts: int
    by_category: dict[str, int]
    by_agent: dict[str, int]
    top_tags: list[dict]