"""Clip API routes: shared web/video clipping library."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_agent_or_admin
from app.core.database import get_db
from app.models.admin_user import AdminUser
from app.models.agent import Agent
from app.schemas.clip import (
    ClipCreate,
    ClipDetailResponse,
    ClipListResponse,
    ClipResponse,
    ClipSearchParams,
    ClipStatsResponse,
    ClipUpdate,
)
from app.schemas.common import PaginatedResponse
from app.services.clip_service import ClipService

router = APIRouter()


def _ensure_can_write(current_agent: Agent | AdminUser) -> None:
    if isinstance(current_agent, AdminUser):
        return
    if not current_agent.can_write_as_agent(current_agent.agent_type):
        raise HTTPException(status_code=403, detail="No write permission for this agent")


@router.post("/clips", response_model=ClipResponse, status_code=201)
async def create_clip(
    payload: ClipCreate,
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(get_current_agent_or_admin),
):
    """Create a clip as the current agent (or as admin from the web UI)."""
    _ensure_can_write(current_agent)
    clip = await ClipService(db).create(payload, current_agent)
    if not clip:
        raise HTTPException(status_code=400, detail="Failed to create clip")
    return clip


@router.get("/clips", response_model=PaginatedResponse[ClipListResponse])
async def list_clips(
    params: ClipSearchParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(get_current_agent_or_admin),
):
    """List clips with search and filters, newest first."""
    result = await ClipService(db).list_clips(
        agent_name=params.agent_name,
        category=params.category,
        tag=params.tag,
        source_type=params.source_type,
        status=params.status,
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


@router.get("/clips/stats", response_model=ClipStatsResponse)
async def get_clip_stats(
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(get_current_agent_or_admin),
):
    """Get aggregated clip statistics."""
    stats = await ClipService(db).get_stats()
    return ClipStatsResponse(**stats)


@router.get("/clips/{clip_id}", response_model=ClipDetailResponse)
async def get_clip(
    clip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(get_current_agent_or_admin),
):
    """Get one clip with its full Markdown body."""
    clip = await ClipService(db).get_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip


@router.put("/clips/{clip_id}", response_model=ClipResponse)
async def update_clip(
    clip_id: UUID,
    payload: ClipUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(get_current_agent_or_admin),
):
    """Update a clip (author or human admin)."""
    _ensure_can_write(current_agent)
    clip = await ClipService(db).update(clip_id, payload, current_agent)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found or no permission")
    return clip


@router.delete("/clips/{clip_id}", status_code=204)
async def delete_clip(
    clip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent=Depends(get_current_agent_or_admin),
):
    """Delete a clip (author or human admin)."""
    _ensure_can_write(current_agent)
    if not await ClipService(db).delete(clip_id, current_agent):
        raise HTTPException(status_code=404, detail="Clip not found or no permission")
