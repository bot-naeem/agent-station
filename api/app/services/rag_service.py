from typing import Optional
import httpx
from uuid import UUID

from app.core.config import get_settings
from app.services.vector_service import VectorService
from app.schemas.rag import RAGSource, RAGChatMessage

settings = get_settings()


class RAGService:
    def __init__(self, vector_service: VectorService):
        self.vector_service = vector_service
        self.llm_api_url = "https://api.siliconflow.cn/v1/chat/completions"
        self.llm_api_key = settings.embedding_api_key  # 复用同一个 key
        self.llm_model = "Qwen/Qwen2.5-72B-Instruct"

    def _build_context(self, sources: list[RAGSource]) -> str:
        """构建上下文"""
        context_parts = []
        for i, src in enumerate(sources):
            context_parts.append(
                f"[来源 {i+1}]\n"
                f"日期: {src.log_date}\n"
                f"Agent: {src.agent_type}\n"
                f"标题: {src.title or '无'}\n"
                f"文件: {src.file_path}\n"
                f"内容片段:\n{src.chunk_content}\n"
            )
        return "\n---\n".join(context_parts)

    async def generate_answer(self, query: str, sources: list[RAGSource]) -> str:
        """生成 RAG 回答"""
        if not sources:
            return "没有找到相关的上下文信息来回答该问题。"

        context = self._build_context(sources)

        system_prompt = (
            "你是一个智能助手，基于提供的上下文回答用户问题。\n"
            "规则：\n"
            "1. 只能使用提供的上下文信息回答\n"
            "2. 如果上下文不足以回答，请明确说明\n"
            "3. 引用来源时使用 [来源 X] 格式\n"
            "4. 回答要简洁、准确、有帮助\n"
            "5. 使用中文回答"
        )

        user_prompt = f"上下文信息：\n{context}\n\n问题：{query}"

        return await self._call_llm(system_prompt, user_prompt, temperature=0.3)

    async def generate_chat_answer(
        self,
        messages: list[RAGChatMessage],
        sources: list[RAGSource],
        temperature: float = 0.7,
    ) -> str:
        """多轮对话 RAG 回答"""
        if not sources:
            context = "没有找到相关的上下文信息。"
        else:
            context = self._build_context(sources)

        system_prompt = (
            "你是一个智能助手，基于提供的上下文回答用户问题。\n"
            "规则：\n"
            "1. 优先使用提供的上下文信息回答\n"
            "2. 如果上下文不足以回答，可以结合通用知识但要说明\n"
            "3. 引用来源时使用 [来源 X] 格式\n"
            "4. 回答要自然、有帮助\n"
            "5. 使用中文回答"
        )

        # 构建消息历史
        formatted_messages = [{"role": "system", "content": system_prompt}]

        # 添加上下文作为系统消息（仅第一轮）
        formatted_messages.append({"role": "system", "content": f"相关上下文：\n{context}"})

        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        return await self._call_llm_batch(formatted_messages, temperature)

    async def _call_llm(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """调用 LLM API"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                self.llm_api_url,
                headers={
                    "Authorization": f"Bearer {self.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.llm_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": 2000,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_llm_batch(self, messages: list[dict], temperature: float = 0.7) -> str:
        """批量调用 LLM（支持多轮对话）"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                self.llm_api_url,
                headers={
                    "Authorization": f"Bearer {self.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.llm_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": 2000,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]