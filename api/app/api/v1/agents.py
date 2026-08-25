"""Agent management API routes (admin only)"""
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_agent_or_admin, require_permission
from app.models.agent import Agent, AgentPermission
from app.models.admin_user import AdminUser
from app.schemas.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListResponse,
    AgentPermissionUpdate,
)
from app.schemas.common import PaginatedResponse
from app.core.database import get_db

router = APIRouter(prefix="/agents", tags=["agents"])


async def get_current_admin(
    current_user = Depends(get_current_agent_or_admin)
) -> AdminUser:
    """Get current admin user (must be AdminUser with ADMIN permission)"""
    if isinstance(current_user, AdminUser):
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin permission required"
            )
        return current_user
    else:
        # Agent user - check if they have admin permission
        if not current_user.has_permission(AgentPermission.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin permission required"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent users cannot manage other agents"
        )


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(
    payload: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Create a new agent (admin only)"""
    # Check if name already exists
    existing = await db.execute(select(Agent).where(Agent.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Agent name already exists")
    
    # Generate API key
    api_key = Agent.generate_api_key()
    api_key_hash = Agent.hash_api_key(api_key)
    
    agent = Agent(
        name=payload.name,
        display_name=payload.display_name,
        description=payload.description,
        agent_type=payload.agent_type or payload.name,
        api_key_hash=api_key_hash,
        permissions=payload.permissions or ["read_all", "write_own"],
        readable_agent_ids=payload.readable_agent_ids or [],
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    
    # Set plaintext key for response (only time it's shown)
    agent.set_plaintext_key(api_key)
    
    # Return with plaintext key (only time it's shown)
    return agent.to_dict(include_key=True)


@router.get("", response_model=PaginatedResponse[AgentListResponse])
async def list_agents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """List all agents (admin only)"""
    query = select(Agent).order_by(Agent.created_at.desc())
    
    if is_active is not None:
        query = query.where(Agent.is_active == is_active)
    
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    agents = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        items=[a.to_dict() for a in agents],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/me", response_model=AgentResponse)
async def get_current_agent_info(
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get current agent's info"""
    return current_agent.to_dict()


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get agent by ID (admin only)"""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent.to_dict()


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    payload: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Update agent (admin only)"""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Prevent self-deactivation
    if agent.id == current_admin.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "readable_agent_ids":
            import json
            value = json.dumps(value)
        setattr(agent, field, value)
    
    await db.commit()
    await db.refresh(agent)
    return agent.to_dict()


@router.patch("/{agent_id}/permissions", response_model=AgentResponse)
async def update_agent_permissions(
    agent_id: UUID,
    payload: AgentPermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Update agent permissions (admin only)"""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Validate permissions
    valid_perms = [p.value for p in AgentPermission]
    for perm in payload.permissions:
        if perm not in valid_perms:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {perm}")
    
    agent.permissions = payload.permissions
    if payload.readable_agent_ids is not None:
        import json
        # Validate readable agents exist
        if payload.readable_agent_ids:
            readable_agents = await db.execute(
                select(Agent).where(Agent.name.in_(payload.readable_agent_ids))
            )
            found = {a.name for a in readable_agents.scalars().all()}
            not_found = set(payload.readable_agent_ids) - found
            if not_found:
                raise HTTPException(status_code=400, detail=f"Agents not found: {not_found}")
        agent.readable_agent_ids = json.dumps(payload.readable_agent_ids)
    
    await db.commit()
    await db.refresh(agent)
    return agent.to_dict()


@router.post("/{agent_id}/rotate-key", response_model=AgentResponse)
async def rotate_api_key(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Rotate agent's API key (admin only)"""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Generate new key
    new_key = Agent.generate_api_key()
    agent.api_key_hash = Agent.hash_api_key(new_key)
    agent.set_plaintext_key(new_key)
    
    await db.commit()
    await db.refresh(agent)
    
    return agent.to_dict(include_key=True)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Delete agent (admin only)"""
    if agent_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.delete(agent)
    await db.commit()


@router.get("/me", response_model=AgentResponse)
async def get_current_agent_info(
    current_agent = Depends(get_current_agent_or_admin),
):
    """Get current agent's info"""
    return current_agent.to_dict()