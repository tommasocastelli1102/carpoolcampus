"""add profile_photo_url to users

Revision ID: 6f0b6bb467f5
Revises: 99958538d72d
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f0b6bb467f5'
down_revision: Union[str, None] = '99958538d72d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('profile_photo_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'profile_photo_url')
