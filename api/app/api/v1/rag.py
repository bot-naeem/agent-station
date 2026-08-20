"""RAG API routes with multi-agent RBAC"""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_agent
from app.core.database import get_db
from app.models.agent import Agent
from app.models.markdown_log import MarkdownLog
from app.schemas.rag import (
    RAGQueryRequest,
    RAGQueryResponse,
    RAGSource,
    RAGChatRequest,
    RAGChatMessage,
)
from app.services.rag_service import RAGService
from app.services.vector_service import VectorService

router = APIRouter()


@router.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(
    payload: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """RAG query with agent-based filtering"""
    vector_service = VectorService(db)
    rag_service = RAGService(vector_service)

    # Agent-based filtering for search
    agent_type_filter = None
    if current_agent.has_permission("read_all"):
        agent_type_filter = payload.agent_type
    else:
        # Can only search own logs or readable agents
        agent_type_filter = current_agent.agent_type

    # Search relevant documents
    sources = await vector_service.search(
        query=payload.query,
        top_k=payload.top_k,
        score_threshold=payload.score_threshold,
        session_id=payload.session_id,
        agent_type=agent_type_filter,
        use_mmr=payload.use_mmr,
    )

    # Generate answer
    answer = await rag_service.generate_answer(payload.query, sources)

    return RAGQueryResponse(
        answer=answer,
        sources=sources,
        query=payload.query,
    )


@router.post("/rag/chat")
async def rag_chat(
    payload: RAGChatRequest,
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """RAG chat with agent-based filtering"""
    vector_service = VectorService(db)
    rag_service = RAGService(vector_service)

    # Get last user message
    user_messages = [m for m in payload.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message found")

    last_query = user_messages[-1].content

    # Agent-based filtering for search
    agent_type_filter = None
    if current_agent.has_permission("read_all"):
        agent_type_filter = payload.agent_type
    else:
        agent_type_filter = current_agent.agent_type

    # Search relevant documents
    sources = await vector_service.search(
        query=last_query,
        top_k=payload.top_k,
        session_id=payload.session_id,
        agent_type=agent_type_filter,
    )

    # Generate answer
    answer = await rag_service.generate_chat_answer(payload.messages, sources, payload.temperature)

    return {
        "answer": answer,
        "sources": sources,
    }


@router.get("/rag/stats")
async def rag_stats(
    db: AsyncSession = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """Get vector store stats (filtered by agent permissions)"""
    vector_service = VectorService(db)
    stats = await vector_service.get_collection_stats()
    
    # Filter stats by agent permissions if needed
    if not current_agent.has_permission("read_all"):
        # Could filter stats here if needed
        pass
    
    return stats