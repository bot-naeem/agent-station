from datetime import date
from typing import Any
from uuid import UUID
from sqlalchemy import String, Text, Date, Integer, Index, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MarkdownLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "markdown_logs"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    front_matter: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_estimate: Mapped[int | None] = mapped_column(Integer, nullable=True)

    session: Mapped["Session"] = relationship("Session", back_populates="markdown_logs")
    
    # Agent relationship
    agent_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True, index=True
    )
    agent: Mapped["Agent"] = relationship("Agent", back_populates="markdown_logs", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("session_id", "agent_type", "log_date", name="uq_markdown_session_agent_date"),
        Index("ix_markdown_logs_date_agent_desc", "log_date", "agent_type"),
        Index("ix_markdown_logs_session_date", "session_id", "log_date"),
        Index("ix_markdown_logs_agent_type_date", "agent_id", "log_date"),
    )