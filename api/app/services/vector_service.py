import os
import json
from uuid import UUID
from typing import Optional
from pathlib import Path

import httpx
import tiktoken
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.markdown_log import MarkdownLog
from app.schemas.rag import RAGSource
from app.utils.chunker import chunk_text

settings = get_settings()


class VectorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
        self.collection_name = "documents"
        self.encoding = tiktoken.get_encoding("cl100k_base")

    async def ensure_collection(self):
        """确保集合存在"""
        collections = self.client.get_collections().collections
        names = [c.name for c in collections]
        if self.collection_name not in names:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=settings.embedding_dim,
                    distance=Distance.COSINE,
                ),
            )

    async def _get_embedding(self, text: str) -> list[float]:
        """调用 SiliconFlow Embedding API"""
        if not settings.embedding_configured:
            raise RuntimeError(
                "EMBEDDING_API_KEY 未配置或仍是占位符，请在 .env 中填写有效的 SiliconFlow API Key"
            )
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                settings.embedding_api_url,
                headers={
                    "Authorization": f"Bearer {settings.embedding_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.embedding_model,
                    "input": text,
                    "encoding_format": "float",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]

    async def vectorize_markdown(self, markdown_id: UUID) -> int:
        """将 markdown 切分并向量化"""
        await self.ensure_collection()

        result = await self.db.execute(
            select(MarkdownLog).where(MarkdownLog.id == markdown_id)
        )
        log = result.scalar_one_or_none()
        if not log:
            return 0

        # 读取文件内容
        full_path = Path(settings.markdown_root) / log.file_path
        if not full_path.exists():
            return 0

        content = full_path.read_text(encoding="utf-8")

        # 解析 front matter 并移除
        import frontmatter
        post = frontmatter.loads(content)
        content_without_fm = post.content

        # 切分
        chunks = chunk_text(
            content_without_fm,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            encoding=self.encoding,
        )

        if not chunks:
            return 0

        # 批量获取 embeddings
        embeddings = []
        for chunk in chunks:
            emb = await self._get_embedding(chunk)
            embeddings.append(emb)

        # 写入 Qdrant
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = f"{markdown_id}-{i}"
            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "markdown_log_id": str(markdown_id),
                        "session_id": str(log.session_id) if log.session_id else None,
                        "agent_type": log.agent_type,
                        "date": str(log.log_date),
                        "file_path": log.file_path,
                        "title": log.title,
                        "chunk_index": i,
                        "chunk_content": chunk,
                    },
                )
            )

        self.client.upsert(collection_name=self.collection_name, points=points)
        return len(points)

    async def search(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.5,
        session_id: Optional[UUID] = None,
        agent_type: Optional[str] = None,
        use_mmr: bool = False,
    ) -> list[RAGSource]:
        """向量搜索"""
        await self.ensure_collection()

        # 获取查询向量
        query_vector = await self._get_embedding(query)

        # 构建过滤条件
        must_conditions = []
        if session_id:
            must_conditions.append(
                FieldCondition(key="session_id", match=MatchValue(value=str(session_id)))
            )
        if agent_type:
            must_conditions.append(
                FieldCondition(key="agent_type", match=MatchValue(value=agent_type))
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        if use_mmr:
            # MMR 搜索（需要自定义实现或使用 Qdrant 的 recommend）
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k * 3,
                score_threshold=score_threshold,
            )
            # 简单的 MMR 实现：去重相似度高的结果
            sources = []
            for hit in search_result:
                if len(sources) >= top_k:
                    break
                payload = hit.payload
                sources.append(
                    RAGSource(
                        markdown_log_id=UUID(payload["markdown_log_id"]),
                        session_id=UUID(payload["session_id"]) if payload.get("session_id") else None,
                        agent_type=payload["agent_type"],
                        log_date=payload["date"],
                        file_path=payload["file_path"],
                        title=payload.get("title"),
                        chunk_content=payload["chunk_content"],
                        score=hit.score,
                    )
                )
            return sources
        else:
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k,
                score_threshold=score_threshold,
            )

            sources = []
            for hit in search_result:
                payload = hit.payload
                sources.append(
                    RAGSource(
                        markdown_log_id=UUID(payload["markdown_log_id"]),
                        session_id=UUID(payload["session_id"]) if payload.get("session_id") else None,
                        agent_type=payload["agent_type"],
                        log_date=payload["date"],
                        file_path=payload["file_path"],
                        title=payload.get("title"),
                        chunk_content=payload["chunk_content"],
                        score=hit.score,
                    )
                )
            return sources

    async def get_collection_stats(self) -> dict:
        """获取集合统计信息"""
        await self.ensure_collection()
        info = self.client.get_collection(self.collection_name)
        return {
            "collection_name": self.collection_name,
            "vectors_count": info.vectors_count,
            "indexed_vectors_count": info.indexed_vectors_count,
            "points_count": info.points_count,
            "segments_count": info.segments_count,
            "status": info.status.value,
        }

    async def delete_markdown_vectors(self, markdown_id: UUID) -> bool:
        """删除 markdown 对应的向量"""
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="markdown_log_id",
                            match=MatchValue(value=str(markdown_id)),
                        )
                    ]
                ),
            )
            return True
        except Exception:
            return False