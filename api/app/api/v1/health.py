from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import httpx

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import verify_api_key
from app.schemas.common import HealthResponse

router = APIRouter()

settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key),
) -> HealthResponse:
    from datetime import datetime, timezone

    # Check database
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    # Check LLM (MiniMax)
    llm_status = "healthy"
    if not settings.llm_api_key:
        llm_status = "unhealthy"

    # Check Redis
    redis_status = "healthy"
    try:
        import redis.asyncio as redis
        r = redis.from_url(settings.redis_url)
        await r.ping()
        await r.close()
    except Exception:
        redis_status = "unhealthy"

    overall = "healthy" if all(s == "healthy" for s in [db_status, llm_status, redis_status]) else "degraded"

    return HealthResponse(
        status=overall,
        version="0.1.0",
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/health/public")
async def health_check_public() -> HealthResponse:
    from datetime import datetime, timezone
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        timestamp=datetime.now(timezone.utc),
    )