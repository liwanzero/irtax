from app.db.session import SessionLocal
from app.models.plan import Plan
from app.services import stripe_service

PLANS = [
    {"code": "free", "name": "Free", "price_cents": 0, "tier_level": 0, "monthly_conversion_limit": 5},
    {"code": "basico", "name": "Básico", "price_cents": 500, "tier_level": 1, "monthly_conversion_limit": None},
    {"code": "pro", "name": "Pro", "price_cents": 1500, "tier_level": 2, "monthly_conversion_limit": None},
    {"code": "premium", "name": "Premium", "price_cents": 2000, "tier_level": 3, "monthly_conversion_limit": None},
]


def seed_plans() -> None:
    db = SessionLocal()
    try:
        for spec in PLANS:
            plan = db.query(Plan).filter(Plan.code == spec["code"]).first()
            if plan is None:
                plan = Plan(code=spec["code"], name=spec["name"], price_cents=spec["price_cents"])
                db.add(plan)
                db.flush()

            plan.tier_level = spec["tier_level"]
            plan.monthly_conversion_limit = spec["monthly_conversion_limit"]

            if spec["price_cents"] > 0 and not plan.stripe_price_id:
                plan.stripe_price_id = stripe_service.create_product_and_price(
                    spec["name"], spec["price_cents"]
                )

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_plans()
