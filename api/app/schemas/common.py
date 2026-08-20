from datetime import datetime
from uuid import UUID
from typing import Optional, Generic, TypeVar
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar("T")


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime