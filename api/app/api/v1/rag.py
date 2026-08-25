"""RAG Q&A routes — 2-step flow (LLM filter parse → SQL retrieval → LLM synthesis)"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_agent_or_admin
from app.core.database import get_db
from app.models.admin_user import AdminUser
from app.schemas.rag import (
    RAGQueryRequest,
    RAGQueryResponse,
    RAGChatRequest,
    RAGChatMessage,
)
from app.services.rag_service import QnAService

router = APIRouter()


def _scope(current_agent):
    """返回 (can_read_all, own_agent_name)，兼容 Agent 与 AdminUser"""
    if isinstance(current_agent, AdminUser):
        return True, None
    can_all = current_agent.has_permission("read_all")
    return can_all, getattr(current_agent, "display_name", None) or current_agent.name


def _merge_scope_filters(
    payload_agent_name: Optional[str],
    payload_start: Optional[str],
    payload_end: Optional[str],
    can_read_all: bool,
    own_agent_name: Optional[str],
) -> dict:
    """按权限合并检索范围"""
    scope: dict = {}
    if can_read_all:
        if payload_agent_name:
            scope["agent_name"] = payload_agent_name.strip()
    else:
        # 无 read_all 权限：强制限定为自己（调用方显式传了别人名字也忽略）
        scope["agent_name"] = own_agent_name
    if payload_start:
        scope["start_date"] = payload_start
    if payload_end:
        scope["end_date"] = payload_end
    return scope


@router.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(
    payload: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Single-shot RAG query with agent-based scoping"""
    service = QnAService(db)
    can_read_all, own_name = _scope(current_agent)
    scope = _merge_scope_filters(payload.agent_name, payload.start_date, payload.end_date, can_read_all, own_name)

    filters = await service.extract_filters(payload.query)
    # 调用方显式指定的范围优先于 LLM 解析结果
    filters.update({k: v for k, v in scope.items() if v})

    logs = await service.retrieve_logs(payload.query, **filters)
    answer, sources = await service.synthesize_answer(payload.query, logs)
    return RAGQueryResponse(answer=answer, sources=sources)


@router.post("/rag/chat")
async def rag_chat(
    payload: RAGChatRequest,
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Multi-turn RAG chat with agent-based scoping"""
    user_messages = [m for m in payload.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message found")

    last_query = user_messages[-1].content

    service = QnAService(db)
    can_read_all, own_name = _scope(current_agent)
    scope = _merge_scope_filters(payload.agent_name, payload.start_date, payload.end_date, can_read_all, own_name)

    filters = await service.extract_filters(last_query)
    filters.update({k: v for k, v in scope.items() if v})

    logs = await service.retrieve_logs(last_query, **filters)
    answer, sources = await service.synthesize_answer(last_query, logs)

    return {
        "answer": answer,
        "sources": sources,
    }


@router.get("/rag/stats")
async def rag_stats(
    db: AsyncSession = Depends(get_db),
    current_agent = Depends(get_current_agent_or_admin),
):
    """Log store stats (from Postgres now, no vector store)"""
    from sqlalchemy import select, func
    from app.models.markdown_log import MarkdownLog

    total = await db.scalar(select(func.count(MarkdownLog.id)))
    return {"total_logs": total or 0}
