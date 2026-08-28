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
from app.api.deps import get_current_agent_from_api_key, get_current_agent_or_admin, require_permission, require_write_access
from app.models.markdown_log import MarkdownLog
from app.models.session import Session
from app.models.agent import Agent, AgentPermission
from app.models.admin_user import AdminUser
from app.schemas.markdown import (
    MarkdownLogCreate,
    MarkdownLogUpdate,
    MarkdownLogResponse,
    MarkdownLogListResponse,
    MarkdownLogDetailResponse,
    MarkdownLogSearchParams,
    MarkdownStatsResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.markdown_service import MarkdownService
from typing import Union

def get_agent_type(agent: Union[Agent, AdminUser]) -> str:
    """Get agent_type from Agent or AdminUser"""
    if isinstance(agent, AdminUser):
        return "admin"
    return agent.agent_type

def has_permission(agent, perm) -> bool:
    """Check permission for Agent or AdminUser"""
    if isinstance(agent, AdminUser):
        return True
    return agent.has_permission(perm)

def get_readable_agent_ids(agent) -> list:
    """Get readable agent IDs for Agent or AdminUser"""
    if isinstance(agent, AdminUser):
        return None  # Admin can read all
    import json
    readable = json.loads(agent.readable_agent_ids) if agent.readable_agent_ids else []
    return readable

CurrentAgent = Union[Agent, AdminUser]

router = APIRouter()


@router.post("/markdown", response_model=MarkdownLogResponse, status_code=201)
async def create_markdown_log(
    payload: MarkdownLogCreate,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(require_write_access()),
):
    """Create a markdown log entry for the current agent"""
    # Override agent_type with current agent's type
    from app.api.deps import get_current_agent_from_api_key
    from app.api.deps import require_write_access as require_write_access_dep
    # Use the agent's actual type, or "admin" for admin users
    agent_type = getattr(current_agent, 'agent_type', 'admin')
    payload.agent_type = payload.agent_type or agent_type
    service = MarkdownService(db)
    log = await service.create(payload, current_agent=current_agent)

    return log


@router.get("/markdown", response_model=PaginatedResponse[MarkdownLogListResponse])
async def list_markdown_logs(
    params: MarkdownLogSearchParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """List markdown logs with agent-based filtering"""
    from app.models.agent import AgentPermission
    query = select(MarkdownLog).order_by(desc(MarkdownLog.log_date), desc(MarkdownLog.created_at))
    
    # Agent-based filtering - handle both Agent and AdminUser
    def has_perm(agent, perm):
        if isinstance(agent, AdminUser):
            return True
        return agent.has_permission(perm)
    
    agent_type = getattr(current_agent, 'agent_type', 'admin')
    readable_ids = getattr(current_agent, 'readable_agent_ids', None)

    # 解析 agent_name 精确过滤（display_name/name 大小写不敏感精确匹配）
    from app.api.deps import resolve_agent_names_to_ids
    name_filtered_ids = None
    if params.agent_name and params.agent_name.strip():
        name_filtered_ids = await resolve_agent_names_to_ids(db, [params.agent_name])

    # Agent-based filtering
    if has_perm(current_agent, AgentPermission.READ_ALL):
        # Can read all agents - use params filter if provided
        if name_filtered_ids is not None:
            query = query.where(MarkdownLog.agent_id.in_(name_filtered_ids))
        elif params.agent_type:
            query = query.where(MarkdownLog.agent_type == params.agent_type)
    elif has_perm(current_agent, AgentPermission.READ_SPECIFIC):
        import json
        readable = json.loads(readable_ids) if readable_ids else []
        if readable:
            # Get agent IDs that current agent can read
            from app.models.agent import Agent as AgentModel
            readable_agents = await db.execute(
                select(AgentModel.id).where(AgentModel.name.in_(readable))
            )
            readable_ids = [str(r[0]) for r in readable_agents.all()]
            if name_filtered_ids is not None:
                # 请求的名字必须在可读白名单内，交集为空则返回空
                allowed = set(readable_ids) & {str(i) for i in name_filtered_ids}
                query = query.where(MarkdownLog.agent_id.in_(allowed) if allowed else False)
            else:
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
        # 支持短语搜索：引号内的内容作为完整短语匹配，其余词作为 AND 条件
        import re
        phrases = re.findall(r'"([^"]+)"', params.query)
        remaining = re.sub(r'"[^"]+"', '', params.query).strip()
        words = [w for w in remaining.split() if w]
        
        conditions = []
        for phrase in phrases:
            conditions.append(
                or_(
                    MarkdownLog.title.ilike(f"%{phrase}%"),
                    MarkdownLog.summary.ilike(f"%{phrase}%"),
                )
            )
        for word in words:
            conditions.append(
                or_(
                    MarkdownLog.title.ilike(f"%{word}%"),
                    MarkdownLog.summary.ilike(f"%{word}%"),
                )
            )
        
        if conditions:
            query = query.where(or_(*conditions))

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


@router.get("/markdown/stats", response_model=MarkdownStatsResponse)
async def get_markdown_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    agent_type: Optional[str] = Query(None),
    agent_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get markdown statistics with agent-based filtering"""
    base_query = select(MarkdownLog)

    # 解析 agent_name 精确过滤
    from app.api.deps import resolve_agent_names_to_ids
    name_filtered_ids = None
    if agent_name and agent_name.strip():
        name_filtered_ids = await resolve_agent_names_to_ids(db, [agent_name])

    if has_permission(current_agent, AgentPermission.READ_ALL):
        if name_filtered_ids is not None:
            base_query = base_query.where(MarkdownLog.agent_id.in_(name_filtered_ids))
        elif agent_type:
            base_query = base_query.where(MarkdownLog.agent_type == agent_type)
    elif has_permission(current_agent, AgentPermission.READ_SPECIFIC):
        readable = get_readable_agent_ids(current_agent)
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
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get a specific markdown log with read permission check"""
    service = MarkdownService(db)
    log = await service.get_by_id(markdown_id)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    
    # Check read permission
    if not can_read_agent(current_agent, log.agent_id):
        raise HTTPException(status_code=403, detail="Cannot access this log")
    
    return log


def can_read_agent(agent, target_agent_id) -> bool:
    """Check if agent can read target agent's logs"""
    if isinstance(agent, AdminUser):
        return True
    return agent.can_read_agent(target_agent_id)


def can_write_as_agent(agent, target_agent_type) -> bool:
    """Check if agent can write as target agent type"""
    if isinstance(agent, AdminUser):
        return True
    return agent.can_write_as_agent(target_agent_type)


@router.put("/markdown/{markdown_id}", response_model=MarkdownLogResponse)
async def update_markdown_log(
    markdown_id: UUID,
    payload: MarkdownLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Update a markdown log (only own logs or admin)"""
    service = MarkdownService(db)
    log = await service.get_by_id(markdown_id)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    
    # Check write permission (can only update own logs unless admin)
    if not can_write_as_agent(current_agent, log.agent_type):
        raise HTTPException(status_code=403, detail="Cannot update this log")
    
    log = await service.update(markdown_id, payload)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    return log


@router.delete("/markdown/{markdown_id}", status_code=204)
async def delete_markdown_log(
    markdown_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(require_write_access()),
):
    """Delete a markdown log (only own logs or admin)"""
    service = MarkdownService(db)
    log = await service.get_by_id(markdown_id)
    if not log:
        raise HTTPException(status_code=404, detail="Markdown log not found")
    
    # Check write permission
    if not can_write_as_agent(current_agent, log.agent_type):
        raise HTTPException(status_code=403, detail="Cannot delete this log")
    
    success = await service.delete(markdown_id)
    if not success:
        raise HTTPException(status_code=404, detail="Markdown log not found")


@router.post("/markdown/batch-import", response_model=dict)
async def batch_import_markdown(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(require_write_access()),
):
    """Batch import markdown files as current agent"""
    service = MarkdownService(db)
    results = {"success": 0, "skipped": 0, "errors": []}

    for file in files:
        try:
            content = (await file.read()).decode("utf-8")
            payload = MarkdownLogCreate(content=content, agent_type=get_agent_type(current_agent))
            await service.create(payload)
            results["success"] += 1
        except Exception as e:
            results["errors"].append({"file": file.filename, "error": str(e)})

    return results