"""add_todos_agent_id

Revision ID: 4d97a63b12ef
Revises: 3c86945a01bc
Create Date: 2026-08-21 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4d97a63b12ef'
down_revision: Union[str, None] = '3c86945a01bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('todos', sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_todos_agent_id'), 'todos', ['agent_id'], unique=False)
    op.create_foreign_key(
        'fk_todos_agent_id', 'todos', 'agents',
        ['agent_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_todos_agent_id', 'todos', type_='foreignkey')
    op.drop_index(op.f('ix_todos_agent_id'), table_name='todos')
    op.drop_column('todos', 'agent_id')
