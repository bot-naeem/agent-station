from fastapi import APIRouter

from app.api.v1 import (
    health_router,
    markdown_router,
    todos_router,
    rag_router,
    agents_router,
)

api_router = APIRouter()

api_router.include_router(health_router, prefix="", tags=["health"])
api_router.include_router(markdown_router, prefix="", tags=["markdown"])
api_router.include_router(todos_router, prefix="", tags=["todos"])
api_router.include_router(rag_router, prefix="", tags=["rag"])
api_router.include_router(agents_router, prefix="", tags=["agents"])