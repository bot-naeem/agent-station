"""initial migration

Revision ID: 001
Revises: 
Create Date: 2025-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project', sa.String(200), nullable=False),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('task_type', sa.String(50), nullable=True),
        sa.Column('title', sa.String(300), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='running'),
        sa.Column('meta_data', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sessions_project_agent', 'sessions', ['project', 'agent_type'])
    op.create_index('ix_sessions_created_at_desc', 'sessions', ['created_at'], postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})

    # Create markdown_logs table
    op.create_table(
        'markdown_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('log_date', sa.Date, nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_hash', sa.String(64), nullable=True),
        sa.Column('front_matter', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('title', sa.String(300), nullable=True),
        sa.Column('summary', sa.Text, nullable=True),
        sa.Column('tokens_estimate', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'agent_type', 'log_date', name='uq_markdown_session_agent_date'),
    )
    op.create_index('ix_markdown_logs_date_agent_desc', 'markdown_logs', ['log_date', 'agent_type'], postgresql_using='btree', postgresql_ops={'log_date': 'DESC'})
    op.create_index('ix_markdown_logs_session_date', 'markdown_logs', ['session_id', 'log_date'])

    # Create todos table
    op.create_table(
        'todos',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('priority', sa.Integer, nullable=False, server_default='0'),
        sa.Column('meta_data', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_todos_session_status', 'todos', ['session_id', 'status'])
    op.create_index('ix_todos_priority_created', 'todos', ['priority', 'created_at'], postgresql_using='btree', postgresql_ops={'priority': 'DESC'})

    # Create agent_logs table (for future use)
    op.create_table(
        'agent_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('agent_type', sa.String(50), nullable=False),
        sa.Column('task_type', sa.String(50), nullable=False),
        sa.Column('input_json', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('output_json', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('tool_calls', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('tokens_used', sa.Integer, nullable=True),
        sa.Column('duration_ms', sa.Integer, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='success'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_agent_logs_session_type', 'agent_logs', ['session_id', 'agent_type'])
    op.create_index('ix_agent_logs_created_at_desc', 'agent_logs', ['created_at'], postgresql_using='btree', postgresql_ops={'created_at': 'DESC'})


def downgrade() -> None:
    op.drop_table('agent_logs')
    op.drop_table('todos')
    op.drop_table('markdown_logs')
    op.drop_table('sessions')