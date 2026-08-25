import os
import hashlib
import frontmatter
from datetime import date, datetime
from uuid import UUID, uuid4
from pathlib import Path
from typing import Optional
from app.models.agent import Agent

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.markdown_log import MarkdownLog
from app.models.session import Session
from app.schemas.markdown import MarkdownLogCreate, MarkdownLogUpdate, MarkdownLogDetailResponse
from app.utils.markdown_parser import parse_markdown

settings = get_settings()


class MarkdownService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_file_path(self, agent_type: str, log_date: date, session_id: UUID) -> str:
        date_str = log_date.strftime("%Y-%m-%d")
        return f"{date_str}/{agent_type}/session-{session_id.hex[:8]}.md"

    def _compute_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()

    async def create(self, payload: MarkdownLogCreate, current_agent: Optional[Agent] = None) -> MarkdownLogDetailResponse:
        # 解析 markdown
        parsed = parse_markdown(payload.content)
        # 合并 front matter：API 显式传入的为底，content 内嵌 YAML 覆盖
        payload_fm = {}
        if payload.front_matter is not None:
            payload_fm = payload.front_matter.model_dump(exclude_none=True)
        front_matter = {**payload_fm, **parsed.get("front_matter", {})}
        content_without_fm = parsed.get("content", payload.content)

        # 标题优先级：显式传入 > content 首个 # 标题 > front matter.title
        title = payload.title or parsed.get("title") or front_matter.get("title")

        # 确定日期
        log_date = payload.log_date or date.today()

        # 确定 session_id
        session_id = payload.session_id
        if not session_id and front_matter.get("session_id"):
            try:
                session_id = UUID(front_matter["session_id"])
            except ValueError:
                pass

        # 如果没有 session，创建一个
        if not session_id:
            session = Session(
                project=front_matter.get("project", "unknown"),
                agent_type=payload.agent_type,
                task_type=front_matter.get("task_type"),
                title=front_matter.get("title"),
                status=front_matter.get("status", "completed"),
                meta_data=front_matter,
            )
            self.db.add(session)
            await self.db.flush()
            session_id = session.id

        # 生成文件路径和 hash
        file_path = self._generate_file_path(payload.agent_type, log_date, session_id)
        file_hash = self._compute_hash(payload.content)

        # 检查是否已存在（去重）
        existing = await self.db.execute(
            select(MarkdownLog).where(MarkdownLog.file_hash == file_hash)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Markdown with same content already exists")

        # 确保目录存在
        full_path = Path(settings.markdown_root) / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # 写入文件
        full_path.write_text(payload.content, encoding="utf-8")

        # 估算 token
        tokens_estimate = len(content_without_fm) // 4  # 粗略估算

        # 获取 agent_id
        agent_id = current_agent.id if current_agent else None

        # 创建记录
        markdown_log = MarkdownLog(
            session_id=session_id,
            agent_type=payload.agent_type,
            agent_id=agent_id,
            log_date=log_date,
            file_path=file_path,
            file_hash=file_hash,
            front_matter=front_matter,
            title=title,
            summary=parsed.get("summary"),
            tokens_estimate=tokens_estimate,
        )
        self.db.add(markdown_log)
        await self.db.commit()
        await self.db.refresh(markdown_log)

        # 异步向量化

        return await self.get_by_id(markdown_log.id)

    async def get_by_id(self, markdown_id: UUID) -> MarkdownLogDetailResponse:
        result = await self.db.execute(
            select(MarkdownLog).where(MarkdownLog.id == markdown_id)
        )
        log = result.scalar_one_or_none()
        if not log:
            return None

        # 读取文件内容
        full_path = Path(settings.markdown_root) / log.file_path
        content = ""
        if full_path.exists():
            content = full_path.read_text(encoding="utf-8")

        return MarkdownLogDetailResponse(
            id=log.id,
            session_id=log.session_id,
            agent_type=log.agent_type,
            log_date=log.log_date,
            file_path=log.file_path,
            file_hash=log.file_hash,
            front_matter=log.front_matter,
            title=log.title,
            summary=log.summary,
            tokens_estimate=log.tokens_estimate,
            created_at=log.created_at,
            updated_at=log.updated_at,
            content=content,
        )

    async def update(self, markdown_id: UUID, payload: MarkdownLogUpdate) -> Optional[MarkdownLogDetailResponse]:
        result = await self.db.execute(
            select(MarkdownLog).where(MarkdownLog.id == markdown_id)
        )
        log = result.scalar_one_or_none()
        if not log:
            return None

        update_data = payload.model_dump(exclude_unset=True)

        if "content" in update_data:
            # 重新计算 hash 和写入文件
            file_hash = self._compute_hash(update_data["content"])
            full_path = Path(settings.markdown_root) / log.file_path
            full_path.write_text(update_data["content"], encoding="utf-8")
            log.file_hash = file_hash

            # 重新解析
            parsed = parse_markdown(update_data["content"])
            log.front_matter = parsed.get("front_matter", {})
            log.title = parsed.get("title") or log.title
            log.summary = parsed.get("summary") or log.summary
            log.tokens_estimate = len(parsed.get("content", "")) // 4

            # 触发重新向量化

        if "title" in update_data:
            log.title = update_data["title"]
        if "summary" in update_data:
            log.summary = update_data["summary"]
        if "tags" in update_data:
            log.front_matter["tags"] = update_data["tags"]

        await self.db.commit()
        await self.db.refresh(log)
        return await self.get_by_id(markdown_id)

    async def delete(self, markdown_id: UUID) -> bool:
        result = await self.db.execute(
            select(MarkdownLog).where(MarkdownLog.id == markdown_id)
        )
        log = result.scalar_one_or_none()
        if not log:
            return False

        # 删除文件
        full_path = Path(settings.markdown_root) / log.file_path
        if full_path.exists():
            full_path.unlink()

        # 删除记录
        await self.db.delete(log)
        await self.db.commit()
        return True