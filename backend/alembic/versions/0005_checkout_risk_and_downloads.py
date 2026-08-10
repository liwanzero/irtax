"""checkout risk/evidence tracking + job download tracking

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "checkout_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("stripe_checkout_session_id", sa.String(255), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("stripe_charge_id", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("three_ds_result", sa.String(50), nullable=True),
        sa.Column("cvc_check", sa.String(20), nullable=True),
        sa.Column("avs_line1_check", sa.String(20), nullable=True),
        sa.Column("avs_postal_check", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_checkout_attempts_user_id", "checkout_attempts", ["user_id"])
    op.create_index(
        "ix_checkout_attempts_stripe_checkout_session_id",
        "checkout_attempts",
        ["stripe_checkout_session_id"],
        unique=True,
    )
    op.create_index(
        "ix_checkout_attempts_stripe_subscription_id", "checkout_attempts", ["stripe_subscription_id"]
    )

    op.add_column("conversion_jobs", sa.Column("downloaded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("pdf_edit_jobs", sa.Column("downloaded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("pdf_edit_jobs", "downloaded_at")
    op.drop_column("conversion_jobs", "downloaded_at")
    op.drop_index("ix_checkout_attempts_stripe_subscription_id", table_name="checkout_attempts")
    op.drop_index("ix_checkout_attempts_stripe_checkout_session_id", table_name="checkout_attempts")
    op.drop_index("ix_checkout_attempts_user_id", table_name="checkout_attempts")
    op.drop_table("checkout_attempts")
