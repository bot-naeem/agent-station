from fastapi import APIRouter

from app.api.v1 import (
    health_router,
    markdown_router,
    todos_router,
    agents_router,
    auth_router,
    docs_router,
    tasks_router,
    blog_router,
)

api_router = APIRouter()

api_router.include_router(health_router, prefix="", tags=["health"])
api_router.include_router(markdown_router, prefix="", tags=["markdown"])
api_router.include_router(todos_router, prefix="", tags=["todos"])
api_router.include_router(agents_router, prefix="", tags=["agents"])
api_router.include_router(auth_router, prefix="", tags=["auth"])
api_router.include_router(docs_router, prefix="", tags=["docs"])
api_router.include_router(tasks_router, prefix="", tags=["tasks"])
api_router.include_router(blog_router, prefix="", tags=["blog"])