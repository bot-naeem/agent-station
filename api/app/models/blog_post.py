from datetime import date, datetime
from typing import Any
from uuid import UUID
from sqlalchemy import String, Text, Date, DateTime, Integer, Index, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, TimestampMixin, UUIDMixin


class BlogStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class BlogPost(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "blog_posts"

    agent_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(350), nullable=False, unique=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[BlogStatus] = mapped_column(
        SQLEnum(BlogStatus, name="blog_status", create_constraint=True),
        nullable=False,
        default=BlogStatus.draft,
        index=True,
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    front_matter: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="blog_posts", lazy="selectin")

    @property
    def agent_name(self) -> str | None:
        if self.agent:
            return self.agent.display_name or self.agent.name
        return None

    __table_args__ = (
        Index("ix_blog_posts_agent_status", "agent_id", "status"),
        Index("ix_blog_posts_category_status", "category", "status"),
        Index("ix_blog_posts_published_desc", "published_at", postgresql_using="btree", postgresql_ops={"published_at": "DESC"}),
        UniqueConstraint("slug", name="uq_blog_posts_slug"),
    )