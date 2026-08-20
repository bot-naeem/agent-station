"""Markdown API routes with multi-agent RBAC"""
import os
import hashlib
from datetime import date, datetime
from uuid import UUID, uuid4
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import get_db
from app.api.deps import get_current_agent, require_permission, require_write_access
from app.models.markdown_log import MarkdownLog
from app.models.session import Session
from app.models.agent import Agent, AgentPermission
from app.schemas.markdown import (
    MarkdownLogCreate,
    MarkdownLogUpdate,
    MarkdownLogResponse,
    MarkdownLogListResponse,
    MarkdownLogDetailResponse,
    MarkdownLogSearchParams,
    MarkdownCalendarResponse,
    MarkdownStatsResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.markdown_service import MarkdownService
from app.tasks.vectorize import vectorize_markdown

router = APIRouter()


@router.post("/markdown", response_model=MarkdownLogResponse, status_code=201)
async def create_markdown_log(
    payload: MarkdownLogCreate,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(require_write_access()),
):
    """Create a markdown log entry for the current agent"""
    # Override agent_type with current agent's type
    payload.agent_type = current_agent.agent_type
    service = MarkdownService(db)
    log = await service.create(payload, current_agent=current_agent)
    
    # Trigger vectorization
    vectorize_markdown.delay(str(log.id))
    
    return log


@router.get("/markdown", response_model=PaginatedResponse[MarkdownLogListResponse])
async def list_markdown_logs(
    params: MarkdownLogSearchParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """List markdown logs with agent-based filtering"""
    query = select(MarkdownLog).order_by(desc(MarkdownLog.log_date), desc(MarkdownLog.created_at))
    
    # Agent-based filtering
    if current_agent.has_permission(AgentPermission.READ_ALL):
        # Can read all agents - use params filter if provided
        if params.agent_type:
            query = query.where(MarkdownLog.agent_type == params.agent_type)
    elif current_agent.has_permission(AgentPermission.READ_SPECIFIC):
        import json
        readable = json.loads(current_agent.readable_agent_ids)
        if readable:
            # Get agent IDs that current agent can read
            from app.models.agent import Agent as AgentModel
            readable_agents = await db.execute(
                select(AgentModel.id).where(AgentModel.name.in_(readable))
            )
            readable_ids = [str(r[0]) for r in readable_agents.all()]
            query = query.where(MarkdownLog.agent_id.in_(readable_ids))
        else:
            query = query.where(MarkdownLog.agent_id == current_agent.id)
    else:
        # READ_OWN - only own logs
        query = query.where(MarkdownLog.agent_id == current_agent.id)
    
    # Additional filters
    if params.start_date:
        query = query.where(MarkdownLog.log_date >= params.start_date)
    if params.end_date:
        query = query.where(MarkdownLog.log_date <= params.end_date)
    if params.session_id:
        query = query.where(MarkdownLog.session_id == params.session_id)
    if params.tags:
        for tag in params.tags:
            query = query.where(MarkdownLog.front_matter["tags"].contains([tag]))
    if params.query:
        query = query.where(
            or_(
                MarkdownLog.title.ilike(f"%{params.query}%"),
                MarkdownLog.summary.ilike(f"%{params.query}%"),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Paginate
    query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    total_pages = (total + params.page_size - 1) // params.page_size

    return PaginatedResponse(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=total_pages,
    )


@router.get("/markdown/calendar", response_model=List[MarkdownCalendarResponse])
async def get_markdown_calendar(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    agent_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Get calendar view with agent-based filtering"""
    from calendar import monthrange

    start_date = date(year, month, 1)
    end_date = date(year, month, monthrange(year, month)[1])

    # Build base query with agent filtering
    base_query = select(MarkdownLog).where(MarkdownLog.log_date.between(start_date, end_date))
    
    if current_agent.has_permission(AgentPermission.READ_ALL):
        if agent_type:
            base_query = base_query.where(MarkdownLog.agent_type == agent_type)
    elif current_agent.has_permission(AgentPermission.READ_SPECIFIC):
        import json
        readable = json.loads(current_agent.readable_agent_ids)
        if readable:
            from app.models.agent import Agent as AgentModel
            readable_agents = await db.execute(
                select(AgentModel.id).where(AgentModel.name.in_(readable))
            )
            readable_ids = [str(r[0]) for r in readable_agents.all()]
            base_query = base_query.where(MarkdownLog.agent_id.in_(readable_ids))
        else:
            base_query = base_query.where(MarkdownLog.agent_id == current_agent.id)
    else:
        base_query = base_query.where(MarkdownLog.agent_id == current_agent.id)

    query = (
        select(
            MarkdownLog.log_date,
            func.count(MarkdownLog.id).label("count"),
            func.jsonb_object_agg(MarkdownLog.agent_type, func.count(MarkdownLog.id)).label("agents"),
        )
        .select_from(base_query.subquery())
        .group_by(MarkdownLog.log_date)
        .order_by(MarkdownLog.log_date)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        MarkdownCalendarResponse(
            date=row.log_date,
            count=row.count,
            agents=row.agents or {},
        )
        for row in rows
    ]


@router.get("/markdown/stats", response_model=MarkdownStatsResponse)
async def get_markdown_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    agent_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Get markdown statistics with agent-based filtering"""
    base_query = select(MarkdownLog)
    
    if current_agent.has_permission(AgentPermission.READ_ALL):
        if agent_type:
            base_query = base_query.where(MarkdownLog.agent_type == agent_type)
    elif current_agent.has_permission(AgentPermission.READ_SPECIFIC):
        import json
        readable = json.loads(current_agent.readable_agent_ids)
        if readable:
            from app.models.agent import Agent as AgentModel
            readable_agents = await db.execute(
                select(AgentModel.id).where(AgentModel.name.in_(readable))
            )
            readable_ids = [str(r[0]) for r in readable_agents.all()]
            base_query = base_query.where(MarkdownLog.agent_id.in_(readable_ids))
        else:
            base_query = base_query.where(MarkdownLog.agent_id == current_agent.id)
    else:
        base_query = base_query.where(MarkdownLog.agent_id == current_agent.id)

    if start_date:
        base_query = base_query.where(MarkdownLog.log_date >= start_date)
    if end_date:
        base_query = base_query.where(MarkdownLog.log_date <= end_date)

    result = await db.execute(base_query)
    logs = result.scalars().all()

    total_logs = len(logs)
    total_tokens = sum(l.tokens_estimate or 0 for l in logs)
    total_chars = sum(len(l.content) if hasattr(l, 'content') else 0 for l in logs)

    by_agent: dict[str, int] = {}
    by_date: dict[str, int] = {}
    tag_counts: dict[str, int] = {}

    for log in logs:
        by_agent[log.agent_type] = by_agent.get(log.agent_type, 0) + 1
        by_date[str(log.log_date)] = by_date.get(str(log.log_date), 0) + 1
        for tag in log.front_matter.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    top_tags = [{"tag": k, "count": v} for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])[:20]]

    return MarkdownStatsResponse(
        total_logs=total_logs,
        total_tokens=total_tokens,
        total_chars=total_chars,
        by_agent=by_agent,
        by_date=by_date,
        top_tags=top_tags,
    )


@router.get("/markdown/{markdown_id}", response_model=MarkdownLogDetailResponse)
async def get_markdown_log(
    markdown_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Get a specific markdown log with read permission check"""
    service = MarkdownService(db)
    log = await service.get_by_id(markdown_id)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    
    # Check read permission
    if not current_agent.can_read_agent(str(log.agent_id)):
        raise HTTPException(status_code=403, detail="Cannot access this log")
    
    return log


@router.put("/markdown/{markdown_id}", response_model=MarkdownLogResponse)
async def update_markdown_log(
    markdown_id: UUID,
    payload: MarkdownLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Update a markdown log (only own logs or admin)"""
    service = MarkdownService(db)
    log = await service.get_by_id(markdown_id)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    
    # Check write permission (can only update own logs unless admin)
    if not current_agent.can_write_as_agent(log.agent_type):
        raise HTTPException(status_code=403, detail="Cannot update this log")
    
    log = await service.update(markdown_id, payload)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    return log


@router.delete("/markdown/{markdown_id}", status_code=204)
async def delete_markdown_log(
    markdown_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Delete a markdown log (only own logs or admin)"""
    service = MarkdownService(db)
    log = await service.get_by_id(markdown_id)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    
    # Check write permission
    if not current_agent.can_write_as_agent(log.agent_type):
        raise HTTPException(status_code=403, detail="Cannot delete this log")
    
    success = await service.delete(markdown_id)
    if not success:
        raise HTTPException(status_code=404, detail="Markdown log not found")


@router.post("/markdown/batch-import", response_model=dict)
async def batch_import_markdown(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Batch import markdown files as current agent"""
    service = MarkdownService(db)
    results = {"success": 0, "skipped": 0, "errors": []}

    for file in files:
        try:
            content = (await file.read()).decode("utf-8")
            payload = MarkdownLogCreate(content=content, agent_type=current_agent.agent_type)
            await service.create(payload)
            results["success"] += 1
        except Exception as e:
            results["errors"].append({"file": file.filename, "error": str(e)})

    return results