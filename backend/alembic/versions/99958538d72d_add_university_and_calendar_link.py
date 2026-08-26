"""add university and calendar_link to users

Revision ID: 99958538d72d
Revises: 715175668c0f
Create Date: 2026-08-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99958538d72d'
down_revision: Union[str, None] = '715175668c0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('university', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('calendar_link', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'calendar_link')
    op.drop_column('users', 'university')
