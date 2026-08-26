"""rename review star categories to drive_safety/clean_car/good_company

Revision ID: 5b7d229ea1f9
Revises: 6f0b6bb467f5
Create Date: 2026-08-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5b7d229ea1f9'
down_revision: Union[str, None] = '6f0b6bb467f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('reviews', 'stars_driving_style', new_column_name='stars_drive_safety')
    op.alter_column('reviews', 'stars_cleanliness', new_column_name='stars_clean_car')
    op.alter_column('reviews', 'stars_speed', new_column_name='stars_good_company')
    # stars_punctuality is unchanged


def downgrade() -> None:
    op.alter_column('reviews', 'stars_drive_safety', new_column_name='stars_driving_style')
    op.alter_column('reviews', 'stars_clean_car', new_column_name='stars_cleanliness')
    op.alter_column('reviews', 'stars_good_company', new_column_name='stars_speed')
