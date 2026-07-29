from sqlalchemy.orm import Session

from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.services import stripe_service


def provision_new_user(
    db: Session,
    email: str,
    password_hash: str | None = None,
    google_id: str | None = None,
) -> User:
    stripe_customer_id = stripe_service.create_customer(email)

    user = User(
        email=email,
        password_hash=password_hash,
        google_id=google_id,
        stripe_customer_id=stripe_customer_id,
    )
    db.add(user)
    db.flush()  # populate user.id before creating the subscription row

    free_plan = db.query(Plan).filter(Plan.code == "free").first()
    if free_plan is not None:
        db.add(Subscription(user_id=user.id, plan_id=free_plan.id, status="active"))

    db.commit()
    db.refresh(user)
    return user


def user_plan_and_status(db: Session, user: User) -> tuple[str, str]:
    subscription = user.subscription
    if subscription is None:
        return "free", "active"
    plan = db.get(Plan, subscription.plan_id)
    return (plan.code if plan else "free"), subscription.status


def get_user_plan(db: Session, user: User) -> Plan:
    subscription = user.subscription
    if subscription is not None:
        plan = db.get(Plan, subscription.plan_id)
        if plan is not None:
            return plan
    return db.query(Plan).filter(Plan.code == "free").first()
