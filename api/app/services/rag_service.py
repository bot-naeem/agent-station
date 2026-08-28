"""Q&A service: filter extraction → SQL full-text retrieval → LLM synthesis (no vector RAG)"""
import json
import re
from typing import Any, Optional
from uuid import UUID

import httpx
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.markdown_log import MarkdownLog
from app.models.blog_post import BlogPost, BlogStatus
from app.schemas.rag import RAGSource

settings = get_settings()

FILTER_SYSTEM_PROMPT = (
    "你是查询解析器。根据用户问题，输出 JSON 对象，字段：\n"
    '{"start_date": "YYYY-MM-DD 或 null", "end_date": "YYYY-MM-DD 或 null", '
    '"agent_name": "精确Agent名称或 null", "keywords": ["关键词1", "关键词2"]}\n'
    "规则：\n"
    "- 今天是 {today}。'昨天/上周/最近三天'等相对时间换算为具体日期范围\n"
    "- 提到某个 Agent 的名字时填 agent_name\n"
    "- keywords 提取 2-4 个用于全文检索的核心词（中文为主）\n"
    '- 只输出 JSON，不要其他文字'
)

ANSWER_SYSTEM_PROMPT = (
    "你是工作日志助手，基于提供的日志上下文回答问题。\n"
    "规则：\n"
    "1. 只能使用提供的日志内容回答，不要编造\n"
    "2. 引用来源使用 [来源 X] 格式\n"
    "3. 如果上下文不足以回答，明确说明\n"
    "4. 用中文简洁回答"
)


class QnAService:
    """Two-step Q&A: LLM filter parsing → SQL retrieval → LLM answer"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------- LLM 调用（Anthropic 协议） ----------------

    async def _call_llm(self, system: str, user: str, max_tokens: int = 2000) -> str:
        if not settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY 未配置")
        url = f"{settings.llm_api_base}/v1/messages"
        headers = {
            "x-api-key": settings.llm_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.llm_model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            # Anthropic 格式: content 为块数组
            parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
            return "".join(parts).strip()

    # ---------------- 第 1 步：解析过滤条件 ----------------

    async def extract_filters(self, question: str) -> dict[str, Any]:
        from datetime import date
        today = date.today().isoformat()
        try:
            raw = await self._call_llm(
                FILTER_SYSTEM_PROMPT.replace("{today}", today),
                question,
                max_tokens=300,
            )
            # 容忍模型输出 ```json 包裹
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            filters = json.loads(m.group(0)) if m else {}
        except Exception:
            filters = {}
        return {
            "start_date": filters.get("start_date") or None,
            "end_date": filters.get("end_date") or None,
            "agent_name": filters.get("agent_name") or None,
            "keywords": [k for k in (filters.get("keywords") or []) if k][:4],
        }

    # ---------------- 第 2 步：SQL 检索全文 ----------------

    async def retrieve_logs(
        self,
        question: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        agent_name: Optional[str] = None,
        keywords: Optional[list[str]] = None,
        limit: int = 12,
    ) -> list[dict]:
        from datetime import date as _date
        from app.api.deps import resolve_agent_names_to_ids

        query = select(MarkdownLog).order_by(
            MarkdownLog.log_date.desc(), MarkdownLog.created_at.desc()
        ).limit(limit * 3)

        if start_date:
            try:
                query = query.where(MarkdownLog.log_date >= _date.fromisoformat(start_date))
            except ValueError:
                pass
        if end_date:
            try:
                query = query.where(MarkdownLog.log_date <= _date.fromisoformat(end_date))
            except ValueError:
                pass
        if agent_name:
            ids = await resolve_agent_names_to_ids(self.db, [agent_name])
            if not ids:
                return []
            query = query.where(MarkdownLog.agent_id.in_(ids))

        result = await self.db.execute(query)
        logs = result.scalars().all()
        if not logs:
            return []

        # 关键词相关性排序：命中标题 > 摘要 > 正文，按命中数取前 limit 条
        kws = [k.lower() for k in (keywords or []) if k.strip()]

        def score(log: MarkdownLog) -> int:
            title = (log.title or "").lower()
            summary = (log.summary or "").lower()
            s = sum(2 for k in kws if k in title)
            s += sum(1 for k in kws if k in summary)
            return s

        ranked = sorted(logs, key=score, reverse=True)[:limit]
        return [
            {
                "log": log,
                "title": log.title or log.file_path.split("/")[-1].replace(".md", ""),
                "agent_name": getattr(log, "agent_name", None) or log.agent_type,
                "log_date": str(log.log_date),
                "content": self._read_content(log),
            }
            for log in ranked
        ]

    def _read_content(self, log: MarkdownLog) -> str:
        """读取磁盘上的日志全文（截断防超长）"""
        from pathlib import Path
        try:
            full_path = Path(settings.markdown_root) / log.file_path
            text = full_path.read_text(encoding="utf-8")
            return text[:4000]
        except Exception:
            return log.summary or ""

    # ---------------- 博客检索 ----------------

    async def retrieve_blogs(
        self,
        question: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        agent_name: Optional[str] = None,
        keywords: Optional[list[str]] = None,
        limit: int = 6,
    ) -> list[dict]:
        """Retrieve relevant blog posts (published only)"""
        from datetime import date as _date
        from app.api.deps import resolve_agent_names_to_ids

        query = select(BlogPost).where(BlogPost.status == BlogStatus.published).order_by(
            BlogPost.published_at.desc().nullslast(), BlogPost.created_at.desc()
        ).limit(limit * 3)

        if start_date:
            try:
                query = query.where(BlogPost.published_at >= _date.fromisoformat(start_date))
            except ValueError:
                pass
        if end_date:
            try:
                query = query.where(BlogPost.published_at <= _date.fromisoformat(end_date))
            except ValueError:
                pass
        if agent_name:
            ids = await resolve_agent_names_to_ids(self.db, [agent_name])
            if not ids:
                return []
            query = query.where(BlogPost.agent_id.in_(ids))

        result = await self.db.execute(query)
        blogs = result.scalars().all()
        if not blogs:
            return []

        kws = [k.lower() for k in (keywords or []) if k.strip()]

        def score(blog: BlogPost) -> int:
            title = (blog.title or "").lower()
            summary = (blog.summary or "").lower()
            content = (blog.content or "").lower()
            s = sum(3 for k in kws if k in title)
            s += sum(2 for k in kws if k in summary)
            s += sum(1 for k in kws if k in content)
            return s

        ranked = sorted(blogs, key=score, reverse=True)[:limit]
        return [
            {
                "blog": blog,
                "title": blog.title,
                "agent_name": blog.agent_name or blog.agent_id,
                "log_date": str(blog.published_at or blog.created_at)[:10],
                "content": blog.content[:4000],
            }
            for blog in ranked
        ]

    # ---------------- 第 3 步：合成回答 ----------------

    async def synthesize_answer(
        self, question: str, logs: list[dict], blogs: list[dict] | None = None
    ) -> tuple[str, list[RAGSource]]:
        blogs = blogs or []
        if not logs and not blogs:
            return "没有找到相关的日志或博客来回答这个问题。", []

        context_parts = []
        sources: list[RAGSource] = []
        idx = 1

        # 日志来源
        for item in logs:
            context_parts.append(
                f"[来源 {idx}]\n日期: {item['log_date']}\n"
                f"Agent: {item['agent_name']}\n标题: {item['title']}\n"
                f"内容:\n{item['content']}"
            )
            log = item["log"]
            sources.append(
                RAGSource(
                    markdown_log_id=log.id,
                    session_id=log.session_id,
                    agent_type=item["agent_name"],
                    log_date=item["log_date"],
                    file_path=log.file_path,
                    title=item["title"],
                    chunk_content=(log.summary or item["content"][:200]),
                    score=1.0,
                )
            )
            idx += 1

        # 博客来源
        for item in blogs:
            context_parts.append(
                f"[博客 {idx}]\n日期: {item['log_date']}\n"
                f"作者: {item['agent_name']}\n标题: {item['title']}\n"
                f"内容:\n{item['content']}"
            )
            blog = item["blog"]
            sources.append(
                RAGSource(
                    markdown_log_id=blog.id,
                    session_id=blog.session_id if hasattr(blog, "session_id") else None,
                    agent_type=item["agent_name"],
                    log_date=item["log_date"],
                    file_path=f"blogs/{blog.slug}",
                    title=item["title"],
                    chunk_content=(blog.summary or item["content"][:200]),
                    score=1.0,
                )
            )
            idx += 1

        context = "\n---\n".join(context_parts)
        total_sources = len(logs) + len(blogs)
        user_prompt = f"日志与博客上下文（共 {total_sources} 篇）：\n{context}\n\n问题：{question}"
        answer = await self._call_llm(ANSWER_SYSTEM_PROMPT, user_prompt, max_tokens=2000)
        return answer, sources
