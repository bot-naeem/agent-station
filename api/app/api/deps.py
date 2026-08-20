from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_api_key


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


def get_current_api_key(api_key: str = Depends(verify_api_key)) -> str:
    return api_key