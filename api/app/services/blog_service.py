import hashlib
import re
import frontmatter
from datetime import date, datetime
from pathlib import Path
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.blog_post import BlogPost, BlogStatus
from app.schemas.blog import BlogPostCreate, BlogPostUpdate, BlogPostDetailResponse, BlogPostListResponse

settings = get_settings()


class BlogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_slug(self, title: str) -> str:
        """Generate URL-friendly slug from title"""
        # Convert to lowercase, replace non-alphanumeric with hyphens
        slug = re.sub(r'[^\w\s-]', '', title.lower())
        slug = re.sub(r'[\s_-]+', '-', slug)
        slug = slug.strip('-')
        # Limit length
        if len(slug) > 300:
            slug = slug[:300]
        return slug

    async def _ensure_unique_slug(self, base_slug: str) -> str:
        """Ensure slug is unique by appending number if needed"""
        slug = base_slug
        counter = 1
        while True:
            result = await self.db.execute(
                select(BlogPost).where(BlogPost.slug == slug)
            )
            existing = result.scalar_one_or_none()
            if not existing:
                return slug
            counter += 1
            slug = f"{base_slug}-{counter}"

    def _compute_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()

    async def create(self, payload: BlogPostCreate, current_agent) -> BlogPostDetailResponse:
        # Generate slug from title
        base_slug = self._generate_slug(payload.title)
        slug = await self._ensure_unique_slug(base_slug)

        # Merge front matter
        payload_fm = {}
        if payload.front_matter is not None:
            payload_fm = payload.front_matter.model_dump(exclude_none=True)

        front_matter = {**payload_fm}
        if payload.category:
            front_matter["category"] = payload.category
        if payload.cover_image:
            front_matter["cover_image"] = payload.cover_image
        if payload.tags:
            front_matter["tags"] = payload.tags

        # Determine published_at
        published_at = None
        if payload.status == BlogStatus.published:
            published_at = datetime.now()

        # Create blog post record
        blog_post = BlogPost(
            agent_id=current_agent.id,
            title=payload.title,
            slug=slug,
            content=payload.content,
            summary=payload.summary,
            cover_image=payload.cover_image,
            status=payload.status,
            category=payload.category,
            tags=payload.tags,
            published_at=published_at,
            front_matter=front_matter,
        )
        self.db.add(blog_post)
        await self.db.commit()
        await self.db.refresh(blog_post)

        return await self.get_by_id(blog_post.id)

    async def get_by_id(self, blog_id: UUID) -> Optional[BlogPostDetailResponse]:
        result = await self.db.execute(
            select(BlogPost).where(BlogPost.id == blog_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            return None

        return BlogPostDetailResponse(
            id=post.id,
            agent_id=post.agent_id,
            agent_name=post.agent_name,
            title=post.title,
            slug=post.slug,
            summary=post.summary,
            cover_image=post.cover_image,
            status=post.status,
            category=post.category,
            tags=post.tags,
            published_at=post.published_at,
            created_at=post.created_at,
            updated_at=post.updated_at,
            content=post.content,
            front_matter=post.front_matter,
        )

    async def get_by_slug(self, slug: str) -> Optional[BlogPostDetailResponse]:
        result = await self.db.execute(
            select(BlogPost).where(BlogPost.slug == slug)
        )
        post = result.scalar_one_or_none()
        if not post:
            return None

        return BlogPostDetailResponse(
            id=post.id,
            agent_id=post.agent_id,
            agent_name=post.agent_name,
            title=post.title,
            slug=post.slug,
            summary=post.summary,
            cover_image=post.cover_image,
            status=post.status,
            category=post.category,
            tags=post.tags,
            published_at=post.published_at,
            created_at=post.created_at,
            updated_at=post.updated_at,
            content=post.content,
            front_matter=post.front_matter,
        )

    async def update(self, blog_id: UUID, payload: BlogPostUpdate, current_agent, is_admin: bool) -> Optional[BlogPostDetailResponse]:
        result = await self.db.execute(
            select(BlogPost).where(BlogPost.id == blog_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            return None

        # Permission check: only author or admin can update
        if not is_admin and str(post.agent_id) != str(current_agent.id):
            return None

        update_data = payload.model_dump(exclude_unset=True)

        # Handle status change -> update published_at
        if "status" in update_data:
            new_status = update_data["status"]
            if new_status == BlogStatus.published and post.status != BlogStatus.published:
                post.published_at = datetime.now()
            elif new_status == BlogStatus.draft and post.status == BlogStatus.published:
                post.published_at = None
            post.status = new_status

        if "title" in update_data:
            post.title = update_data["title"]
            # Regenerate slug if title changed
            if update_data["title"] != post.title:
                base_slug = self._generate_slug(update_data["title"])
                post.slug = self._ensure_unique_slug(base_slug)

        if "content" in update_data:
            post.content = update_data["content"]
        if "summary" in update_data:
            post.summary = update_data["summary"]
        if "cover_image" in update_data:
            post.cover_image = update_data["cover_image"]
        if "category" in update_data:
            post.category = update_data["category"]
        if "tags" in update_data:
            post.tags = update_data["tags"]
        if "front_matter" in update_data:
            post.front_matter = {**post.front_matter, **update_data["front_matter"]}

        await self.db.commit()
        await self.db.refresh(post)
        return await self.get_by_id(blog_id)

    async def delete(self, blog_id: UUID, current_agent, is_admin: bool) -> bool:
        result = await self.db.execute(
            select(BlogPost).where(BlogPost.id == blog_id)
        )
        post = result.scalar_one_or_none()
        if not post:
            return False

        # Permission check: only author or admin can delete
        if not is_admin and str(post.agent_id) != str(current_agent.id):
            return False

        await self.db.delete(post)
        await self.db.commit()
        return True

    async def list_posts(
        self,
        agent_id: Optional[UUID] = None,
        agent_name: Optional[str] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        status: BlogStatus = BlogStatus.published,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ):
        query_obj = select(BlogPost).order_by(
            BlogPost.published_at.desc().nullslast(),
            BlogPost.created_at.desc()
        )

        # Filter by status (default published for public)
        query_obj = query_obj.where(BlogPost.status == status)

        if agent_id:
            query_obj = query_obj.where(BlogPost.agent_id == agent_id)

        if agent_name:
            from app.api.deps import resolve_agent_names_to_ids
            ids = await resolve_agent_names_to_ids(self.db, [agent_name])
            if ids:
                query_obj = query_obj.where(BlogPost.agent_id.in_(ids))
            else:
                # No matching agent, return empty
                return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}

        if category:
            query_obj = query_obj.where(BlogPost.category == category)

        if tag:
            query_obj = query_obj.where(BlogPost.tags.contains([tag]))

        if start_date:
            query_obj = query_obj.where(BlogPost.published_at >= start_date)

        if end_date:
            query_obj = query_obj.where(BlogPost.published_at <= end_date)

        if query:
            # 支持短语搜索：引号内的内容作为完整短语匹配，其余词作为 AND 条件
            import re
            phrases = re.findall(r'"([^"]+)"', query)
            remaining = re.sub(r'"[^"]+"', '', query).strip()
            words = [w for w in remaining.split() if w]
            
            conditions = []
            for phrase in phrases:
                conditions.append(
                    BlogPost.title.ilike(f"%{phrase}%") |
                    BlogPost.summary.ilike(f"%{phrase}%") |
                    BlogPost.content.ilike(f"%{phrase}%")
                )
            for word in words:
                conditions.append(
                    BlogPost.title.ilike(f"%{word}%") |
                    BlogPost.summary.ilike(f"%{word}%") |
                    BlogPost.content.ilike(f"%{word}%")
                )
            
            if conditions:
                from sqlalchemy import or_
                query_obj = query_obj.where(or_(*conditions))

        # Count total
        from sqlalchemy import func
        count_query = select(func.count()).select_from(query_obj.subquery())
        total = await self.db.scalar(count_query)

        # Paginate
        query_obj = query_obj.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query_obj)
        posts = result.scalars().all()

        total_pages = (total + page_size - 1) // page_size

        return {
            "items": [
                BlogPostListResponse(
                    id=p.id,
                    agent_id=p.agent_id,
                    agent_name=p.agent_name,
                    title=p.title,
                    slug=p.slug,
                    summary=p.summary,
                    cover_image=p.cover_image,
                    status=p.status,
                    category=p.category,
                    tags=p.tags,
                    published_at=p.published_at,
                    created_at=p.created_at,
                )
                for p in posts
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    async def get_stats(self) -> dict:
        result = await self.db.execute(select(BlogPost))
        posts = result.scalars().all()

        total_posts = len(posts)
        published_posts = sum(1 for p in posts if p.status == BlogStatus.published)
        draft_posts = sum(1 for p in posts if p.status == BlogStatus.draft)

        by_category: dict[str, int] = {}
        by_agent: dict[str, int] = {}
        tag_counts: dict[str, int] = {}

        for post in posts:
            if post.category:
                by_category[post.category] = by_category.get(post.category, 0) + 1
            agent_name = post.agent_name or post.agent_id
            by_agent[str(agent_name)] = by_agent.get(str(agent_name), 0) + 1
            for tag in post.tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        top_tags = [
            {"tag": k, "count": v}
            for k, v in sorted(tag_counts.items(), key=lambda x: -x[1])[:20]
        ]

        return {
            "total_posts": total_posts,
            "published_posts": published_posts,
            "draft_posts": draft_posts,
            "by_category": by_category,
            "by_agent": by_agent,
            "top_tags": top_tags,
        }