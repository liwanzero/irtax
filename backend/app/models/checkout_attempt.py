from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CheckoutAttempt(Base):
    """Append-only audit trail for Stripe Checkout attempts, used as dispute evidence.

    Kept separate from Subscription (which is unique per user and overwritten on renewal/
    plan change) so fraud-relevant signals from the original checkout survive over time.
    """

    __tablename__ = "checkout_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    stripe_checkout_session_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    stripe_charge_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    three_ds_result: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cvc_check: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avs_line1_check: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avs_postal_check: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
