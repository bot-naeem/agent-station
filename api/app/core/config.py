from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

EMBEDDING_KEY_PLACEHOLDER = "<请填入你的SiliconFlow API Key>"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    postgres_user: str = "agentlog"
    postgres_password: str = "changeme"
    postgres_db: str = "agent_logs"
    database_url: str = "postgresql://agentlog:changeme@postgres:5432/agent_logs"

    # Qdrant
    qdrant_url: str = "http://qdrant:6333"
    qdrant_api_key: str = ""

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Embedding (SiliconFlow)
    embedding_api_url: str = "https://api.siliconflow.cn/v1/embeddings"
    embedding_api_key: str = ""
    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    chunk_size: int = 500
    chunk_overlap: int = 50

    @property
    def embedding_configured(self) -> bool:
        """embedding key 是否为有效配置（非空且非占位符）"""
        return bool(
            self.embedding_api_key
            and self.embedding_api_key != EMBEDDING_KEY_PLACEHOLDER
        )

    # API
    api_secret_key: str = "changeme"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_key: str = "sk-agent-log-changeme"

    # Markdown
    markdown_root: str = "/data/markdown"

    # Frontend
    vite_api_base: str = "https://codingfamily.online/api/v1"
    vite_ws_base: str = "wss://codingfamily.online/ws"


@lru_cache
def get_settings() -> Settings:
    return Settings()