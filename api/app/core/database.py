from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# 确保使用 asyncpg 驱动（将 postgresql:// 转为 postgresql+asyncpg://）
db_url = settings.database_url
if db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# 使用 NullPool：Celery 任务每次 asyncio.run() 新建 event loop，
# 连接池复用旧 loop 连接会导致 "attached to a different loop" 错误
engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)