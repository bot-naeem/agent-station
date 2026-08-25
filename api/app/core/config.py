from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict



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

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # LLM (MiniMax, Anthropic-compatible protocol)
    llm_api_base: str = "https://api.minimaxi.com/anthropic"
    llm_api_key: str = ""
    llm_model: str = "MiniMax-M3"

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