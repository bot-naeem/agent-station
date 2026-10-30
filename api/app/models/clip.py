from uuid import UUID

from sqlalchemy import String, Text, Index, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Clip(Base, UUIDMixin, TimestampMixin):
    """A clipped piece of content from the web, an article or a video transcript."""

    __tablename__ = "clips"

    agent_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="web", index=True)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="published", index=True)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="clips", lazy="selectin")

    @property
    def agent_name(self) -> str | None:
        if self.agent:
            return self.agent.display_name or self.agent.name
        return None

    __table_args__ = (
        Index("ix_clips_agent_status", "agent_id", "status"),
        Index("ix_clips_category_status", "category", "status"),
        Index("ix_clips_source_type_status", "source_type", "status"),
    )
