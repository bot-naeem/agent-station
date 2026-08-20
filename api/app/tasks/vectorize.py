from celery import shared_task
from uuid import UUID

from app.core.celery_app import celery_app
from app.core.database import async_session_maker
from app.services.vector_service import VectorService


@celery_app.task(bind=True)
def vectorize_markdown(self, markdown_id: str):
    """异步向量化 markdown"""
    import asyncio

    async def _vectorize():
        async with async_session_maker() as db:
            vector_service = VectorService(db)
            await vector_service.ensure_collection()
            count = await vector_service.vectorize_markdown(UUID(markdown_id))
            return count

    return asyncio.run(_vectorize())


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 3},
)
def reindex_all(self):
    """重新索引所有 markdown"""
    import asyncio

    async def _reindex():
        async with async_session_maker() as db:
            from sqlalchemy import select
            from app.models.markdown_log import MarkdownLog

            result = await db.execute(select(MarkdownLog.id))
            ids = [str(row[0]) for row in result.all()]

            for markdown_id in ids:
                vectorize_markdown.delay(markdown_id)

            return {"queued": len(ids)}

    return asyncio.run(_reindex())