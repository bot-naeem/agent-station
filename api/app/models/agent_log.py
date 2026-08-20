from uuid import UUID
from typing import Any
from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class AgentLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "agent_logs"

    session_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    input_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    output_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    tool_calls: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success", index=True)

    session: Mapped["Session | None"] = relationship("Session", backref="agent_logs")

    __table_args__ = (
        Index("ix_agent_logs_session_type", "session_id", "agent_type"),
        Index("ix_agent_logs_created_at_desc", "created_at"),
    )