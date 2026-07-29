from pydantic import BaseModel


class PlanOut(BaseModel):
    id: int
    code: str
    name: str
    price_cents: int
    tier_level: int
    monthly_conversion_limit: int | None

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    plan_id: int
