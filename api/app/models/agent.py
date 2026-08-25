"""Agent model for multi-agent RBAC"""
import enum
import json
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, Enum as SQLEnum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

import uuid

from app.models.base import Base


class AgentPermission(str, enum.Enum):
    """Agent permission levels"""
    READ_OWN = "read_own"           # Can read own logs only
    READ_ALL = "read_all"           # Can read all agents' logs
    READ_SPECIFIC = "read_specific" # Can read specific agents' logs (via agent_permissions)
    WRITE_OWN = "write_own"         # Can write to own agent_type only
    ADMIN = "admin"                 # Full access


class Agent(Base):
    """Registered AI agent with API key and permissions"""
    __tablename__ = "agents"

    id: Mapped[PG_UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Hashed API key (never stored in plaintext)
    api_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    
    # Agent type used in logs (defaults to name)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Permissions as JSON string
    _permissions: Mapped[str] = mapped_column(
        "permissions", Text, default='["read_all", "write_own"]', nullable=False
    )
    
    # For READ_SPECIFIC: list of agent IDs this agent can read
    _readable_agent_ids: Mapped[str] = mapped_column(
        "readable_agent_ids", Text, default="[]", nullable=False
    )
    
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    sessions = relationship("Session", back_populates="agent", lazy="dynamic")
    markdown_logs = relationship("MarkdownLog", back_populates="agent", lazy="dynamic")

    __table_args__ = (
        Index("ix_agents_name_active", "name", "is_active"),
    )

    # Properties for JSON serialization (not hybrid to avoid constructor issues)
    @property
    def permissions(self) -> List[str]:
        val = getattr(self, '_permissions', None)
        return json.loads(val) if val else []
    
    @permissions.setter
    def permissions(self, value: List[str]) -> None:
        self._permissions = json.dumps(value)
    
    @property
    def readable_agent_ids(self) -> List[str]:
        val = getattr(self, '_readable_agent_ids', None)
        return json.loads(val) if val else []
    
    @readable_agent_ids.setter
    def readable_agent_ids(self, value: List[str]) -> None:
        self._readable_agent_ids = json.dumps(value)

    # ... rest of the methods unchanged
    @staticmethod
    def hash_api_key(api_key: str) -> str:
        """Hash API key with SHA-256"""
        return hashlib.sha256(api_key.encode()).hexdigest()

    @staticmethod
    def generate_api_key() -> str:
        """Generate a new API key"""
        return f"sk-alp-{secrets.token_urlsafe(32)}"

    def verify_api_key(self, api_key: str) -> bool:
        """Verify provided API key against stored hash"""
        return self.api_key_hash == self.hash_api_key(api_key)

    def has_permission(self, perm) -> bool:
        """Check if agent has a specific permission (accepts AgentPermission enum or plain string)"""
        from enum import Enum as _Enum
        value = perm.value if isinstance(perm, _Enum) else str(perm)
        return value in self.permissions

    def can_read_agent(self, target_agent_id: str) -> bool:
        """Check if this agent can read another agent's logs"""
        if self.has_permission(AgentPermission.READ_ALL):
            return True
        if self.has_permission(AgentPermission.READ_OWN):
            return str(self.id) == target_agent_id
        if self.has_permission(AgentPermission.READ_SPECIFIC):
            return target_agent_id in self.readable_agent_ids
        return False

    def can_write_as_agent(self, target_agent_type: str) -> bool:
        """Check if this agent can write logs as a specific agent_type"""
        if self.has_permission(AgentPermission.ADMIN):
            return True
        return self.agent_type == target_agent_type

    def to_dict(self, include_key: bool = False) -> dict:
        """Convert to dict, optionally including plaintext key (only on creation)"""
        # Ensure readable_agent_ids is always a list
        readable_ids = self.readable_agent_ids
        if isinstance(readable_ids, str):
            import json
            try:
                readable_ids = json.loads(readable_ids)
            except Exception:
                readable_ids = []
        elif not isinstance(readable_ids, list):
            readable_ids = []
        
        return {
            "id": str(self.id),
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "agent_type": self.agent_type,
            "permissions": self.permissions,
            "readable_agent_ids": readable_ids,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "api_key": getattr(self, '_plaintext_key', None) if include_key else None,
        }
    
    def set_plaintext_key(self, key: str):
        """Store plaintext key temporarily for response (only on creation/rotation)"""
        self._plaintext_key = key