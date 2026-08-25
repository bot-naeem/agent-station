"""fix_agent_fk_ondelete_set_null

Revision ID: 3c86945a01bc
Revises: 2a758343b89a
Create Date: 2026-08-21 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3c86945a01bc'
down_revision: Union[str, None] = '2a758343b89a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('fk_sessions_agent_id', 'sessions', type_='foreignkey')
    op.create_foreign_key(
        'fk_sessions_agent_id', 'sessions', 'agents',
        ['agent_id'], ['id'], ondelete='SET NULL',
    )

    op.drop_constraint('fk_markdown_logs_agent_id', 'markdown_logs', type_='foreignkey')
    op.create_foreign_key(
        'fk_markdown_logs_agent_id', 'markdown_logs', 'agents',
        ['agent_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_markdown_logs_agent_id', 'markdown_logs', type_='foreignkey')
    op.create_foreign_key('fk_markdown_logs_agent_id', 'markdown_logs', 'agents', ['agent_id'], ['id'])

    op.drop_constraint('fk_sessions_agent_id', 'sessions', type_='foreignkey')
    op.create_foreign_key('fk_sessions_agent_id', 'sessions', 'agents', ['agent_id'], ['id'])
