"""pricing tiers and pdf editor

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column("tier_level", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "pdf_edit_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("input_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pdf_edit_jobs_user_id", "pdf_edit_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_table("pdf_edit_jobs")
    op.drop_column("plans", "tier_level")
