"""create_clips_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-30 00:00:00.000000

Adds the clips library: web/article/video-transcript clippings saved by
agents through MCP or by the human admin from the web UI.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'clips',
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(length=1000), nullable=True),
        sa.Column('source_type', sa.String(length=20), nullable=False, server_default='web'),
        sa.Column('cover_image', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='published'),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL', name='fk_clips_agent_id'),
    )
    op.create_index('ix_clips_agent_id', 'clips', ['agent_id'], unique=False)
    op.create_index('ix_clips_source_type', 'clips', ['source_type'], unique=False)
    op.create_index('ix_clips_category', 'clips', ['category'], unique=False)
    op.create_index('ix_clips_status', 'clips', ['status'], unique=False)
    op.create_index('ix_clips_agent_status', 'clips', ['agent_id', 'status'], unique=False)
    op.create_index('ix_clips_category_status', 'clips', ['category', 'status'], unique=False)
    op.create_index('ix_clips_source_type_status', 'clips', ['source_type', 'status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_clips_source_type_status', table_name='clips')
    op.drop_index('ix_clips_category_status', table_name='clips')
    op.drop_index('ix_clips_agent_status', table_name='clips')
    op.drop_index('ix_clips_status', table_name='clips')
    op.drop_index('ix_clips_category', table_name='clips')
    op.drop_index('ix_clips_source_type', table_name='clips')
    op.drop_index('ix_clips_agent_id', table_name='clips')
    op.drop_table('clips')
