from datetime import datetime

from pydantic import BaseModel


class CheckoutAttemptOut(BaseModel):
    id: int
    stripe_checkout_session_id: str
    stripe_subscription_id: str | None
    stripe_charge_id: str | None
    ip_address: str | None
    user_agent: str | None
    three_ds_result: str | None
    cvc_check: str | None
    avs_line1_check: str | None
    avs_postal_check: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class JobUsageOut(BaseModel):
    kind: str  # "conversion" | "edit"
    id: int
    original_filename: str
    status: str
    created_at: datetime
    downloaded_at: datetime | None


class SubscriptionSummaryOut(BaseModel):
    plan_name: str
    plan_code: str
    status: str
    current_period_end: datetime | None
    stripe_subscription_id: str | None


class AdminLookupOut(BaseModel):
    user_id: int
    email: str
    created_at: datetime
    stripe_customer_id: str | None
    subscription: SubscriptionSummaryOut | None
    checkout_attempts: list[CheckoutAttemptOut]
    jobs: list[JobUsageOut]
