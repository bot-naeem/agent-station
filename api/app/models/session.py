from typing import Any
from sqlalchemy import String, Text, Index, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

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
    
    # Agent relationship
    agent_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True, index=True
    )
    agent: Mapped["Agent"] = relationship("Agent", back_populates="sessions", lazy="selectin")
    markdown_logs: Mapped[list["MarkdownLog"]] = relationship(
        "MarkdownLog", back_populates="session", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_sessions_project_agent", "project", "agent_type"),
        Index("ix_sessions_created_at_desc", "created_at"),
    )