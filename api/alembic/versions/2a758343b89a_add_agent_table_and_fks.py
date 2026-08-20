"""add_agent_table_and_fks

Revision ID: 2a758343b89a
Revises: 001
Create Date: 2026-08-20 08:37:31.668396

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2a758343b89a'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create agents table
    op.create_table(
        'agents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('agent_type', sa.String(length=100), nullable=False),
        sa.Column('api_key_hash', sa.String(length=64), nullable=False),
        sa.Column('permissions', sa.Text(), nullable=False, server_default='["read_all", "write_own"]'),
        sa.Column('readable_agent_ids', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(op.f('ix_agents_name_active'), 'agents', ['name', 'is_active'], unique=False)

    # Add agent_id to sessions
    op.add_column('sessions', sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_sessions_agent_id'), 'sessions', ['agent_id'], unique=False)
    op.create_foreign_key('fk_sessions_agent_id', 'sessions', 'agents', ['agent_id'], ['id'])

    # Add agent_id to markdown_logs
    op.add_column('markdown_logs', sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_markdown_logs_agent_id'), 'markdown_logs', ['agent_id'], unique=False)
    op.create_index('ix_markdown_logs_agent_type_date', 'markdown_logs', ['agent_id', 'log_date'], unique=False)
    op.create_foreign_key('fk_markdown_logs_agent_id', 'markdown_logs', 'agents', ['agent_id'], ['id'])

    # Add agent_id to todos
    op.add_column('todos', sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_todos_agent_id'), 'todos', ['agent_id'], unique=False)
    op.create_foreign_key('fk_todos_agent_id', 'todos', 'agents', ['agent_id'], ['id'])

    # Update existing indexes
    op.drop_index(op.f('ix_agent_logs_created_at_desc'), table_name='agent_logs')
    op.create_index(op.f('ix_agent_logs_created_at_desc'), 'agent_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_agent_logs_agent_type'), 'agent_logs', ['agent_type'], unique=False)
    op.create_index(op.f('ix_agent_logs_session_id'), 'agent_logs', ['session_id'], unique=False)
    op.create_index(op.f('ix_agent_logs_status'), 'agent_logs', ['status'], unique=False)
    op.create_index(op.f('ix_agent_logs_task_type'), 'agent_logs', ['task_type'], unique=False)
    op.drop_index(op.f('ix_markdown_logs_date_agent_desc'), table_name='markdown_logs')
    op.create_index(op.f('ix_markdown_logs_date_agent_desc'), 'markdown_logs', ['log_date', 'agent_type'], unique=False)
    op.create_index(op.f('ix_markdown_logs_agent_type'), 'markdown_logs', ['agent_type'], unique=False)
    op.create_index(op.f('ix_markdown_logs_log_date'), 'markdown_logs', ['log_date'], unique=False)
    op.create_index(op.f('ix_markdown_logs_session_id'), 'markdown_logs', ['session_id'], unique=False)
    op.drop_index(op.f('ix_sessions_created_at_desc'), table_name='sessions')
    op.create_index(op.f('ix_sessions_created_at_desc'), 'sessions', ['created_at'], unique=False)
    op.create_index(op.f('ix_sessions_agent_type'), 'sessions', ['agent_type'], unique=False)
    op.create_index(op.f('ix_sessions_project'), 'sessions', ['project'], unique=False)
    op.create_index(op.f('ix_sessions_status'), 'sessions', ['status'], unique=False)
    op.create_index(op.f('ix_sessions_task_type'), 'sessions', ['task_type'], unique=False)
    op.drop_index(op.f('ix_todos_priority_created'), table_name='todos')
    op.create_index(op.f('ix_todos_priority_created'), 'todos', ['priority', 'created_at'], unique=False)
    op.create_index(op.f('ix_todos_session_id'), 'todos', ['session_id'], unique=False)
    op.create_index(op.f('ix_todos_status'), 'todos', ['status'], unique=False)


def downgrade() -> None:
    # Drop foreign keys and columns
    op.drop_constraint('fk_todos_agent_id', 'todos', type_='foreignkey')
    op.drop_index(op.f('ix_todos_agent_id'), table_name='todos')
    op.drop_column('todos', 'agent_id')

    op.drop_constraint('fk_markdown_logs_agent_id', 'markdown_logs', type_='foreignkey')
    op.drop_index(op.f('ix_markdown_logs_agent_id'), table_name='markdown_logs')
    op.drop_index('ix_markdown_logs_agent_type_date', table_name='markdown_logs')
    op.drop_column('markdown_logs', 'agent_id')

    op.drop_constraint('fk_sessions_agent_id', 'sessions', type_='foreignkey')
    op.drop_index(op.f('ix_sessions_agent_id'), table_name='sessions')
    op.drop_column('sessions', 'agent_id')

    # Drop agents table
    op.drop_index(op.f('ix_agents_name_active'), table_name='agents')
    op.drop_table('agents')

    # Restore indexes
    op.drop_index(op.f('ix_todos_status'), table_name='todos')
    op.drop_index(op.f('ix_todos_session_id'), table_name='todos')
    op.drop_index(op.f('ix_todos_priority_created'), table_name='todos')
    op.create_index(op.f('ix_todos_priority_created'), 'todos', [sa.literal_column('priority DESC'), 'created_at'], unique=False)
    op.drop_index(op.f('ix_sessions_task_type'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_status'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_project'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_agent_type'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_created_at_desc'), table_name='sessions')
    op.create_index(op.f('ix_sessions_created_at_desc'), 'sessions', [sa.literal_column('created_at DESC')], unique=False)
    op.drop_index(op.f('ix_markdown_logs_session_id'), table_name='markdown_logs')
    op.drop_index(op.f('ix_markdown_logs_log_date'), table_name='markdown_logs')
    op.drop_index(op.f('ix_markdown_logs_agent_type'), table_name='markdown_logs')
    op.drop_index(op.f('ix_markdown_logs_date_agent_desc'), table_name='markdown_logs')
    op.create_index(op.f('ix_markdown_logs_date_agent_desc'), 'markdown_logs', [sa.literal_column('log_date DESC'), 'agent_type'], unique=False)
    op.drop_index(op.f('ix_agent_logs_task_type'), table_name='agent_logs')
    op.drop_index(op.f('ix_agent_logs_status'), table_name='agent_logs')
    op.drop_index(op.f('ix_agent_logs_session_id'), table_name='agent_logs')
    op.drop_index(op.f('ix_agent_logs_agent_type'), table_name='agent_logs')
    op.drop_index(op.f('ix_agent_logs_created_at_desc'), table_name='agent_logs')
    op.create_index(op.f('ix_agent_logs_created_at_desc'), 'agent_logs', [sa.literal_column('created_at DESC')], unique=False)