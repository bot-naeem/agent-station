"""Todos API routes with multi-agent RBAC"""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_agent_from_api_key as get_current_agent
from app.core.database import get_db
from app.models.agent import Agent
from app.models.todo import Todo
from app.schemas.todo import (
    TodoCreate,
    TodoUpdate,
    TodoResponse,
    TodoListParams,
    TodoBatchUpdate,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.post("/todos", response_model=TodoResponse, status_code=201)
async def create_todo(
    payload: TodoCreate,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Create a todo for the current agent"""
    todo = Todo(**payload.model_dump(), agent_id=current_agent.id)
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.get("/todos", response_model=PaginatedResponse[TodoResponse])
async def list_todos(
    params: TodoListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """List todos for current agent (or readable agents)"""
    query = select(Todo).where(Todo.agent_id == current_agent.id).order_by(
        desc(Todo.priority), desc(Todo.created_at)
    )

    if params.session_id:
        query = query.where(Todo.session_id == params.session_id)
    if params.status:
        query = query.where(Todo.status == params.status)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

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


@router.get("/todos/{todo_id}", response_model=TodoResponse)
async def get_todo(
    todo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.agent_id == current_agent.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.put("/todos/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: UUID,
    payload: TodoUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.agent_id == current_agent.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(todo, field, value)

    await db.commit()
    await db.refresh(todo)
    return todo


@router.patch("/todos/batch", response_model=dict)
async def batch_update_todos(
    payload: TodoBatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Todo).where(Todo.id.in_(payload.ids), Todo.agent_id == current_agent.id)
    )
    todos = result.scalars().all()

    updated = 0
    for todo in todos:
        if payload.status is not None:
            todo.status = payload.status
        if payload.priority is not None:
            todo.priority = payload.priority
        updated += 1

    await db.commit()
    return {"updated": updated}


@router.delete("/todos/{todo_id}", status_code=204)
async def delete_todo(
    todo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    result = await db.execute(
        select(Todo).where(Todo.id == todo_id, Todo.agent_id == current_agent.id)
    )
    todo = result.scalar_one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    await db.delete(todo)
    await db.commit()