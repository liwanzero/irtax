"""allow anonymous conversion jobs

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("conversion_jobs", "user_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("conversion_jobs", sa.Column("anon_token", sa.String(64), nullable=True))
    op.create_index("ix_conversion_jobs_anon_token", "conversion_jobs", ["anon_token"])


def downgrade() -> None:
    op.drop_index("ix_conversion_jobs_anon_token", table_name="conversion_jobs")
    op.drop_column("conversion_jobs", "anon_token")
    op.alter_column("conversion_jobs", "user_id", existing_type=sa.Integer(), nullable=False)
