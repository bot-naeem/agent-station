"""drop_tokens_estimate_column

Revision ID: a1b2c3d4e5f6
Revises: f6a7b8c9d0e1
Create Date: 2026-10-08 00:00:00.000000

Token stats removed: platform no longer estimates or stores per-log
tokens. Drops markdown_logs.tokens_estimate. Downgrade re-adds the
nullable column (values stay NULL, no recompute).

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('markdown_logs', 'tokens_estimate')


def downgrade() -> None:
    op.add_column('markdown_logs', sa.Column('tokens_estimate', sa.Integer(), nullable=True))
