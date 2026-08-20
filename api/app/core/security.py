from fastapi import Depends, HTTPException, Header, status
from typing import Optional

from app.core.config import get_settings

settings = get_settings()


async def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> str:
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
        )
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    return x_api_key


def create_access_token(data: dict, expires_delta: Optional[int] = None) -> str:
    from datetime import datetime, timedelta, timezone
    from jose import jwt

    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + timedelta(seconds=expires_delta)
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.api_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    from jose import jwt, JWTError

    try:
        return jwt.decode(token, settings.api_secret_key, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )