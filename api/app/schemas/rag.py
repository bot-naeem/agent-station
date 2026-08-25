from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[UUID] = None
    agent_type: Optional[str] = None
    agent_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    top_k: int = Field(5, ge=1, le=20)
    score_threshold: float = Field(0.5, ge=0.0, le=1.0)
    use_mmr: bool = False


class RAGSource(BaseModel):
    markdown_log_id: UUID
    session_id: Optional[UUID]
    agent_type: str
    log_date: str
    file_path: str
    title: Optional[str]
    chunk_content: str
    score: float


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[RAGSource]
    query: str


class RAGChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class RAGChatRequest(BaseModel):
    messages: list[RAGChatMessage]
    session_id: Optional[UUID] = None
    agent_type: Optional[str] = None
    agent_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    top_k: int = Field(5, ge=1, le=20)
    temperature: float = Field(0.7, ge=0.0, le=2.0)