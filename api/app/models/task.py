"""Task 模型：智能体任务管理（四态工作流）"""
from typing import Any
from uuid import UUID

from sqlalchemy import String, Text, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin

# 四态定义：待办 → 进行中 → 完成/废弃
TASK_STATUSES = ["待办", "进行中", "完成", "废弃"]
ACTIVE_STATUSES = ["待办", "进行中"]
TERMINAL_STATUSES = ["完成", "废弃"]


def is_valid_status(s: str) -> bool:
    return s in TASK_STATUSES


def is_terminal_status(s: str) -> bool:
    return s in TERMINAL_STATUSES


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"

    agent_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="待办", index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    project: Mapped[str | None] = mapped_column(String(200), nullable=True)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)  # close_task 归档结论
    status_history: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)

    __table_args__ = (
        # 同一 Agent 内 title 唯一（重名必须报错，不静默覆盖）
        UniqueConstraint("agent_id", "title", name="uq_tasks_agent_title"),
        Index("ix_tasks_agent_status", "agent_id", "status"),
        Index("ix_tasks_updated_at", "updated_at"),
    )

    def append_history(self, from_status: str | None, to_status: str) -> None:
        """状态变更追加历史记录"""
        if self.status_history is None:
            self.status_history = []
        history = list(self.status_history)
        history.append({"from": from_status, "to": to_status, "at": _now_iso()})
        self.status_history = history  # 重新赋值以触发 JSONB 变更检测


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
