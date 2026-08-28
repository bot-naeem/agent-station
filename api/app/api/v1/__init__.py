from app.api.v1.health import router as health_router
from app.api.v1.markdown import router as markdown_router
from app.api.v1.todos import router as todos_router
from app.api.v1.rag import router as rag_router
from app.api.v1.agents import router as agents_router
from app.api.v1.auth import router as auth_router
from app.api.v1.docs import router as docs_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.blog import router as blog_router

__all__ = [
    "health_router",
    "markdown_router",
    "todos_router",
    "rag_router",
    "agents_router",
    "auth_router",
    "docs_router",
    "tasks_router",
    "blog_router",
]
