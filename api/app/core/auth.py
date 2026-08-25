"""JWT Authentication for Admin Web UI"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
import secrets
import jwt
from fastapi import Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_db
from app.models.admin_user import AdminUser

settings = get_settings()

# JWT 配置
SECRET_KEY = settings.api_secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer(auto_error=False)


def create_access_token(user_id: UUID, username: str, is_superuser: bool) -> str:
    """创建 JWT token"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user_id),
        "username": username,
        "is_superuser": is_superuser,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """解码并验证 JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.PyJWTError:
        return None


async def get_current_admin_user(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Optional["AdminUser"]:
    """从 Cookie 或 Header 获取当前管理员用户"""
    # 优先从 Cookie 读取
    token = request.cookies.get("admin_token")
    
    # 如果没有 Cookie，尝试从 Authorization Header 读取
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        return None
    
    payload = decode_token(token)
    if not payload:
        return None
    
    user_id = UUID(payload.get("sub"))
    result = await db.execute(
        select(AdminUser).where(AdminUser.id == UUID(payload["sub"]))
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        return None
    
    return user


async def require_admin_user(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> "AdminUser":
    """要求必须是已登录的管理员"""
    user = await get_current_admin_user(request, response, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或登录已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_superuser(
    current_user: "AdminUser" = Depends(require_admin_user),
) -> "AdminUser":
    """要求必须是超级管理员"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要超级管理员权限",
        )
    return current_user


def set_auth_cookie(response: Response, token: str) -> None:
    """设置认证 Cookie"""
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        secure=True,  # HTTPS 环境下生效
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """清除认证 Cookie"""
    response.delete_cookie(key="admin_token", path="/", secure=True, samesite="lax")