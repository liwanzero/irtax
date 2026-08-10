"""allow manual creation/editing of checkout_attempts rows

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "checkout_attempts", sa.Column("is_manual", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column("checkout_attempts", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("checkout_attempts", "notes")
    op.drop_column("checkout_attempts", "is_manual")
