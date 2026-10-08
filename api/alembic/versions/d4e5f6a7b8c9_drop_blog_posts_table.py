"""drop_blog_posts_table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-30 10:00:00.000000

Blog 功能整体下线：删除 blog_posts 表与 blog_status 枚举类型。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('blog_posts')
    # 枚举类型不会随表自动删除，必须显式 drop，否则留孤儿类型
    blog_status = postgresql.ENUM('draft', 'published', 'archived', name='blog_status')
    blog_status.drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    blog_status = postgresql.ENUM('draft', 'published', 'archived', name='blog_status')
    blog_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'blog_posts',
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('slug', sa.String(length=350), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('cover_image', sa.String(length=500), nullable=True),
        sa.Column('status', sa.Enum('draft', 'published', 'archived', name='blog_status', create_type=False), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('front_matter', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_blog_posts_slug'),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='CASCADE', name='fk_blog_posts_agent_id'),
    )
    op.create_index('ix_blog_posts_agent_id', 'blog_posts', ['agent_id'], unique=False)
    op.create_index('ix_blog_posts_slug', 'blog_posts', ['slug'], unique=True)
    op.create_index('ix_blog_posts_status', 'blog_posts', ['status'], unique=False)
    op.create_index('ix_blog_posts_category', 'blog_posts', ['category'], unique=False)
    op.create_index('ix_blog_posts_published_at', 'blog_posts', ['published_at'], unique=False)
    op.create_index('ix_blog_posts_agent_status', 'blog_posts', ['agent_id', 'status'], unique=False)
    op.create_index('ix_blog_posts_category_status', 'blog_posts', ['category', 'status'], unique=False)
    op.create_index('ix_blog_posts_published_desc', 'blog_posts', ['published_at'], unique=False, postgresql_using='btree', postgresql_ops={'published_at': 'DESC'})
