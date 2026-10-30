import re
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.admin_user import AdminUser
from app.models.clip import Clip
from app.schemas.clip import ClipCreate, ClipDetailResponse, ClipListResponse, ClipUpdate


class ClipService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _clean_tags(tags: list[str]) -> list[str]:
        seen: set[str] = set()
        cleaned: list[str] = []
        for tag in tags:
            value = tag.strip()
            if value and value not in seen:
                seen.add(value)
                cleaned.append(value)
        return cleaned

    @staticmethod
    def _derive_summary(content: str, limit: int = 240) -> str:
        text = re.sub(r"```.*?```", " ", content, flags=re.S)
        text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
        text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
        text = re.sub(r"[#>*_`~\-]+", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:limit]

    async def create(self, payload: ClipCreate, current_agent: Agent | AdminUser) -> ClipDetailResponse:
        summary = payload.summary.strip() if payload.summary else ""
        if not summary:
            summary = self._derive_summary(payload.content)

        clip = Clip(
            agent_id=current_agent.id if isinstance(current_agent, Agent) else None,
            title=payload.title.strip(),
            content=payload.content,
            summary=summary or None,
            source_url=payload.source_url.strip() if payload.source_url else None,
            source_type=payload.source_type,
            cover_image=payload.cover_image.strip() if payload.cover_image else None,
            category=payload.category.strip() if payload.category else None,
            tags=self._clean_tags(payload.tags),
            status=payload.status,
        )
        self.db.add(clip)
        await self.db.commit()
        await self.db.refresh(clip)
        return await self.get_by_id(clip.id)

    async def get_by_id(self, clip_id: UUID) -> Optional[ClipDetailResponse]:
        result = await self.db.execute(select(Clip).where(Clip.id == clip_id))
        clip = result.scalar_one_or_none()
        if not clip:
            return None
        return ClipDetailResponse.model_validate(clip)

    async def update(
        self,
        clip_id: UUID,
        payload: ClipUpdate,
        current_agent: Agent | AdminUser,
    ) -> Optional[ClipDetailResponse]:
        result = await self.db.execute(select(Clip).where(Clip.id == clip_id))
        clip = result.scalar_one_or_none()
        if not clip:
            return None
        if not self._can_modify(clip, current_agent):
            return None

        data = payload.model_dump(exclude_unset=True)
        for field in ("title", "content", "summary", "source_url", "cover_image", "category", "status"):
            if field in data:
                value = data[field]
                if isinstance(value, str):
                    value = value.strip() or None
                setattr(clip, field, value)
        if "tags" in data and data["tags"] is not None:
            clip.tags = self._clean_tags(data["tags"])
        if "source_type" in data and data["source_type"]:
            clip.source_type = data["source_type"]
        if not clip.summary and clip.content:
            clip.summary = self._derive_summary(clip.content)

        await self.db.commit()
        await self.db.refresh(clip)
        return await self.get_by_id(clip_id)

    async def delete(self, clip_id: UUID, current_agent: Agent | AdminUser) -> bool:
        result = await self.db.execute(select(Clip).where(Clip.id == clip_id))
        clip = result.scalar_one_or_none()
        if not clip or not self._can_modify(clip, current_agent):
            return False
        await self.db.delete(clip)
        await self.db.commit()
        return True

    @staticmethod
    def _can_modify(clip: Clip, current_agent: Agent | AdminUser) -> bool:
        if isinstance(current_agent, AdminUser):
            return True
        return clip.agent_id is not None and str(clip.agent_id) == str(current_agent.id)

    async def list_clips(
        self,
        agent_name: Optional[str] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        source_type: Optional[str] = None,
        status: Optional[str] = None,
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        stmt = select(Clip).order_by(Clip.created_at.desc())

        if agent_name and agent_name.strip():
            from app.api.deps import resolve_agent_names_to_ids
            ids = await resolve_agent_names_to_ids(self.db, [agent_name.strip()])
            if not ids:
                return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}
            stmt = stmt.where(Clip.agent_id.in_(ids))
        if category:
            stmt = stmt.where(Clip.category == category)
        if tag:
            stmt = stmt.where(Clip.tags.contains([tag]))
        if source_type:
            stmt = stmt.where(Clip.source_type == source_type)
        if status:
            stmt = stmt.where(Clip.status == status)
        if query and query.strip():
            phrases = re.findall(r'"([^"]+)"', query)
            remaining = re.sub(r'"[^"]+"', "", query).strip()
            words = [w for w in remaining.split() if w]
            conditions = []
            for phrase in phrases:
                conditions.append(
                    or_(
                        Clip.title.ilike(f"%{phrase}%"),
                        Clip.summary.ilike(f"%{phrase}%"),
                        Clip.content.ilike(f"%{phrase}%"),
                    )
                )
            for word in words:
                conditions.append(
                    or_(
                        Clip.title.ilike(f"%{word}%"),
                        Clip.summary.ilike(f"%{word}%"),
                        Clip.content.ilike(f"%{word}%"),
                    )
                )
            for condition in conditions:
                stmt = stmt.where(condition)

        total = await self.db.scalar(select(func.count()).select_from(stmt.subquery()))
        result = await self.db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        clips = result.scalars().all()

        return {
            "items": [ClipListResponse.model_validate(c) for c in clips],
            "total": total or 0,
            "page": page,
            "page_size": page_size,
            "total_pages": ((total or 0) + page_size - 1) // page_size,
        }

    async def get_stats(self) -> dict:
        result = await self.db.execute(select(Clip))
        clips = result.scalars().all()

        by_category: dict[str, int] = {}
        by_agent: dict[str, int] = {}
        by_source_type: dict[str, int] = {}
        tag_counts: dict[str, int] = {}

        for clip in clips:
            if clip.category:
                by_category[clip.category] = by_category.get(clip.category, 0) + 1
            agent_name = clip.agent_name or "Admin"
            by_agent[agent_name] = by_agent.get(agent_name, 0) + 1
            by_source_type[clip.source_type] = by_source_type.get(clip.source_type, 0) + 1
            for tag in clip.tags or []:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        top_tags = [
            {"tag": tag, "count": count}
            for tag, count in sorted(tag_counts.items(), key=lambda item: -item[1])[:20]
        ]

        return {
            "total_clips": len(clips),
            "by_category": by_category,
            "by_agent": by_agent,
            "by_source_type": by_source_type,
            "top_tags": top_tags,
        }
