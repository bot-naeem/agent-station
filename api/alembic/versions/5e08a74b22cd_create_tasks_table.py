"""create_tasks_table

Revision ID: 5e08a74b22cd
Revises: 4d97a63b12ef
Create Date: 2026-08-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5e08a74b22cd'
down_revision: Union[str, None] = '4d97a63b12ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='待办'),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('project', sa.String(length=200), nullable=True),
        sa.Column('result', sa.Text(), nullable=True),
        sa.Column('status_history', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL', name='fk_tasks_agent_id'),
        sa.UniqueConstraint('agent_id', 'title', name='uq_tasks_agent_title'),
    )
    op.create_index('ix_tasks_status', 'tasks', ['status'], unique=False)
    op.create_index('ix_tasks_agent_id', 'tasks', ['agent_id'], unique=False)
    op.create_index('ix_tasks_updated_at', 'tasks', ['updated_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_tasks_updated_at', table_name='tasks')
    op.drop_index('ix_tasks_agent_id', table_name='tasks')
    op.drop_index('ix_tasks_status', table_name='tasks')
    op.drop_table('tasks')
