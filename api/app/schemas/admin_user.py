"""Admin User schemas"""
from typing import Optional
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime


class AdminUserBase(BaseModel):
    username: str
    display_name: str
    email: Optional[str] = None
    is_superuser: bool = False
    is_active: bool = True


class AdminUserCreate(BaseModel):
    username: str
    password: str
    display_name: str
    email: Optional[str] = None
    is_superuser: bool = False


class AdminUserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    username: str
    display_name: str
    email: Optional[str]
    is_superuser: bool
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime