from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import verify_api_key
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

settings = get_settings()


@router.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(
    payload: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    vector_service = VectorService(db)
    rag_service = RAGService(vector_service)

    # 搜索相关文档
    sources = await vector_service.search(
        query=payload.query,
        top_k=payload.top_k,
        score_threshold=payload.score_threshold,
        session_id=payload.session_id,
        agent_type=payload.agent_type,
        use_mmr=payload.use_mmr,
    )

    # 生成回答
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
    api_key: str = Depends(verify_api_key),
):
    vector_service = VectorService(db)
    rag_service = RAGService(vector_service)

    # 获取最后一条用户消息
    user_messages = [m for m in payload.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message found")

    last_query = user_messages[-1].content

    # 搜索相关文档
    sources = await vector_service.search(
        query=last_query,
        top_k=payload.top_k,
        session_id=payload.session_id,
        agent_type=payload.agent_type,
    )

    # 生成回答
    answer = await rag_service.generate_chat_answer(payload.messages, sources, payload.temperature)

    return {
        "answer": answer,
        "sources": sources,
    }


@router.get("/rag/stats")
async def rag_stats(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """获取向量库统计信息"""
    vector_service = VectorService(db)
    stats = await vector_service.get_collection_stats()
    return stats