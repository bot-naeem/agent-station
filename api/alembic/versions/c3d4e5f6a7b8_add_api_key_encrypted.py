"""add api_key_encrypted for view anytime

Revision ID: c3d4e5f6a7b8
Revises: b7e8f9a0c1d2
Create Date: 2026-09-02 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b7e8f9a0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('agents', sa.Column('api_key_encrypted', sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column('agents', 'api_key_encrypted')
