"""Admin Authentication API routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth import (
    create_access_token,
    set_auth_cookie,
    clear_auth_cookie,
    require_admin_user,
)
from app.core.database import get_db
from app.models.admin_user import AdminUser
from app.schemas.admin_user import AdminUserResponse
from app.core.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user: "AdminUserResponse"
    token: str


class TokenResponse(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """用户名密码登录"""
    from app.models.admin_user import AdminUser
    from sqlalchemy import select
    
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == payload.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.verify_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled",
        )
    
    # 更新最后登录时间
    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)
    
    from app.models.base import Base
    # 创建 token
    token = create_access_token(user.id, user.username, user.is_superuser)
    
    # 设置 Cookie
    from app.core.auth import set_auth_cookie
    set_auth_cookie(response, token)
    
    return LoginResponse(
        user=AdminUserResponse(**user.to_dict()),
        token=token,
    )


@router.post("/logout")
async def logout(response: Response):
    """登出"""
    from app.core.auth import clear_auth_cookie
    clear_auth_cookie(response)
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """修改当前登录管理员的密码"""
    from app.core.auth import decode_token
    import jwt
    from app.core.config import get_settings
    from uuid import UUID

    token = request.cookies.get("admin_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = get_settings()
    try:
        data = jwt.decode(token, settings.api_secret_key, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(AdminUser).where(AdminUser.id == UUID(data["sub"])))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")

    if not user.verify_password(payload.old_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    user.password_hash = AdminUser.hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}


@router.get("/me")
async def get_current_user(
    request: Request,
    response: Response,
    db=Depends(get_db),
):
    """获取当前登录用户信息"""
    from app.models.admin_user import AdminUser
    from sqlalchemy import select
    
    # 复用认证逻辑
    from app.core.auth import decode_token
    
    token = request.cookies.get("admin_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    import jwt
    from app.core.config import get_settings
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.api_secret_key, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    from uuid import UUID
    from app.models.admin_user import AdminUser
    from sqlalchemy import select
    
    result = await db.execute(
        select(AdminUser).where(AdminUser.id == payload["sub"])
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    
    from app.schemas.admin_user import AdminUserResponse
    return AdminUserResponse.from_orm(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db=Depends(get_db),
):
    """刷新 Token"""
    from app.core.auth import create_access_token, set_auth_cookie, decode_token
    
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # 生成新 token
    new_token = create_access_token(
        UUID(payload["sub"]),
        payload["username"],
        payload.get("is_superuser", False)
    )
    set_auth_cookie(response, new_token)
    return TokenResponse(token=new_token)