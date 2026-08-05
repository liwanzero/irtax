from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import render_email, send_email
from app.db.session import SessionLocal
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(None)):
    if not settings.stripe_enabled:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Stripe no está configurado")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, settings.stripe_webhook_secret)
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Firma de webhook inválida: {exc}")

    db = SessionLocal()
    try:
        _handle_event(db, event)
    finally:
        db.close()

    return {"received": True}


def _handle_event(db: Session, event) -> None:
    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        subscription_id = obj.get("subscription")
        if subscription_id:
            stripe_sub = stripe.Subscription.retrieve(subscription_id)
            user, plan = _upsert_subscription(db, stripe_sub)
            if user is not None and plan is not None:
                _send_subscription_confirmation(user, plan)
    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        _upsert_subscription(db, obj)


def _upsert_subscription(db: Session, stripe_sub) -> tuple[User | None, Plan | None]:
    user = db.query(User).filter(User.stripe_customer_id == stripe_sub["customer"]).first()
    if user is None:
        return None, None

    price_id = stripe_sub["items"]["data"][0]["price"]["id"]
    plan = db.query(Plan).filter(Plan.stripe_price_id == price_id).first()
    if plan is None:
        return None, None

    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    period_end_ts = stripe_sub["items"]["data"][0]["current_period_end"]
    period_end = datetime.fromtimestamp(period_end_ts, tz=timezone.utc)

    if subscription is None:
        subscription = Subscription(user_id=user.id, plan_id=plan.id)
        db.add(subscription)

    subscription.plan_id = plan.id
    subscription.stripe_subscription_id = stripe_sub["id"]
    subscription.status = stripe_sub["status"]
    subscription.current_period_end = period_end
    db.commit()
    return user, plan


def _send_subscription_confirmation(user: User, plan: Plan) -> None:
    price = f"${plan.price_cents / 100:.0f}/mes" if plan.price_cents else "Gratis"
    send_email(
        user.email,
        f"Confirmación de suscripción — Plan {plan.name} en irtax",
        render_email(
            preheader=f"Ya eres parte del Plan {plan.name} en irtax",
            heading="¡Gracias por suscribirte!",
            body_html=(
                f"<p>Confirmamos tu suscripción al <strong>Plan {plan.name}</strong> ({price}).</p>"
                "<p>Puedes gestionar o cancelar tu suscripción cuando quieras desde Facturación.</p>"
            ),
            cta_text="Ir a Facturación",
            cta_url=f"{settings.frontend_url}/facturacion",
        ),
    )
