"""Authentication dependencies for multi-agent RBAC"""
from typing import Optional
from uuid import UUID
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.agent import Agent, AgentPermission
from app.models.markdown_log import MarkdownLog


async def get_current_agent(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Agent:
    """Get current agent from API key"""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Hash the provided key and look up agent
    from app.models.agent import Agent as AgentModel
    hashed_key = AgentModel.hash_api_key(x_api_key)
    
    result = await db.execute(
        select(Agent).where(
            Agent.api_key_hash == hashed_key,
            Agent.is_active == True
        )
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last_used_at
    from datetime import datetime, timezone
    agent.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    
    return agent


async def get_current_agent_optional(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Optional[Agent]:
    """Get current agent if API key provided, otherwise return None"""
    if not x_api_key:
        return None
    try:
        return await get_current_agent(x_api_key, db)
    except HTTPException:
        return None


def require_permission(permission: AgentPermission):
    """Dependency factory to require a specific permission"""
    async def check_permission(agent: Agent = Depends(get_current_agent)) -> Agent:
        if not agent.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission.value}"
            )
        return agent
    return check_permission


def require_write_access():
    """Dependency to verify agent can write as their own agent_type"""
    async def check_write_access(agent: Agent = Depends(get_current_agent)) -> Agent:
        if not agent.can_write_as_agent(agent.agent_type):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot write logs as agent_type: {agent.agent_type}"
            )
        return agent
    return check_write_access


def require_read_access(target_agent_id: str):
    """Dependency to verify agent can read another agent's logs"""
    async def check_read_access(agent: Agent = Depends(get_current_agent)) -> Agent:
        if not agent.can_read_agent(target_agent_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot read logs of agent: {target_agent_id}"
            )
        return agent
    return check_read_access


async def get_agent_by_id(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
) -> Agent:
    """Get agent by ID with read permission check"""
    from app.models.agent import Agent as AgentModel
    result = await db.execute(select(AgentModel).where(AgentModel.id == agent_id))
    target_agent = result.scalar_one_or_none()
    
    if not target_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not current_agent.can_read_agent(str(target_agent.id)):
        raise HTTPException(status_code=403, detail="Cannot access this agent")
    
    return target_agent