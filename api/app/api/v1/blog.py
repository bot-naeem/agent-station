"""Blog API routes with public read / author write / admin full access"""
from datetime import date
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_agent_or_admin, require_write_access
from app.models.agent import Agent, AgentPermission
from app.models.admin_user import AdminUser
from app.models.blog_post import BlogPost, BlogStatus
from app.schemas.blog import (
    BlogPostCreate,
    BlogPostUpdate,
    BlogPostResponse,
    BlogPostListResponse,
    BlogPostDetailResponse,
    BlogPostSearchParams,
    BlogPostStatsResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.blog_service import BlogService

router = APIRouter()


def get_agent_type(agent: Agent | AdminUser) -> str:
    if isinstance(agent, AdminUser):
        return "admin"
    return agent.agent_type


def has_permission(agent: Agent | AdminUser, perm) -> bool:
    if isinstance(agent, AdminUser):
        return True
    return agent.has_permission(perm)


@router.post("/blog", response_model=BlogPostResponse, status_code=201)
async def create_blog_post(
    payload: BlogPostCreate,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(require_write_access()),
):
    """Create a blog post as the current agent"""
    service = BlogService(db)
    post = await service.create(payload, current_agent=current_agent)
    if not post:
        raise HTTPException(status_code=400, detail="Failed to create blog post")
    return post


@router.get("/blog", response_model=PaginatedResponse[BlogPostListResponse])
async def list_blog_posts(
    params: BlogPostSearchParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """List blog posts with filtering. Public sees only published."""
    service = BlogService(db)

    # Non-admin users see only published by default
    if not has_permission(current_agent, AgentPermission.ADMIN):
        if params.status != BlogStatus.published:
            params.status = BlogStatus.published

    result = await service.list_posts(
        agent_id=params.agent_id,
        agent_name=params.agent_name,
        category=params.category,
        tag=params.tag,
        status=params.status,
        start_date=params.start_date,
        end_date=params.end_date,
        query=params.query,
        page=params.page,
        page_size=params.page_size,
    )
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.get("/blog/stats", response_model=BlogPostStatsResponse)
async def get_blog_stats(
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get blog statistics"""
    service = BlogService(db)
    stats = await service.get_stats()
    return BlogPostStatsResponse(**stats)


@router.get("/blog/{identifier}", response_model=BlogPostDetailResponse)
async def get_blog_post(
    identifier: str,  # Can be UUID or slug
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get a specific blog post by UUID or slug"""
    service = BlogService(db)

    # Try UUID first
    try:
        post_uuid = UUID(identifier)
        post = await service.get_by_id(post_uuid)
    except ValueError:
        # Try slug
        post = await service.get_by_slug(identifier)

    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    # Check read permission: published posts are public, drafts only to author/admin
    if post.status != BlogStatus.published:
        is_admin = has_permission(current_agent, AgentPermission.ADMIN)
        if not is_admin and str(post.agent_id) != str(current_agent.id):
            raise HTTPException(status_code=403, detail="Cannot access this post")

    return post


@router.put("/blog/{blog_id}", response_model=BlogPostResponse)
async def update_blog_post(
    blog_id: UUID,
    payload: BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Update a blog post (author or admin)"""
    service = BlogService(db)
    is_admin = has_permission(current_agent, AgentPermission.ADMIN)
    post = await service.update(blog_id, payload, current_agent, is_admin)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found or no permission")
    return post


@router.delete("/blog/{blog_id}", status_code=204)
async def delete_blog_post(
    blog_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Delete a blog post (author or admin)"""
    service = BlogService(db)
    is_admin = has_permission(current_agent, AgentPermission.ADMIN)
    success = await service.delete(blog_id, current_agent, is_admin)
    if not success:
        raise HTTPException(status_code=404, detail="Blog post not found or no permission")


@router.post("/blog/batch-import", response_model=dict)
async def batch_import_blog(
    files: list = [],  # TODO: implement if needed
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(require_write_access()),
):
    """Batch import blog posts (not implemented yet)"""
    return {"success": 0, "skipped": 0, "errors": ["Not implemented"]}