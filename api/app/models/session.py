from typing import Any
from sqlalchemy import String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Session(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sessions"

    project: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    task_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running", index=True)
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index("ix_sessions_project_agent", "project", "agent_type"),
        Index("ix_sessions_created_at_desc", "created_at"),
    )