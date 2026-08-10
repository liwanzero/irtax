import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import render_email, send_email
from app.db.session import SessionLocal
from app.models.checkout_attempt import CheckoutAttempt
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)

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
        checkout_session_id = obj.get("id")
        subscription_id = obj.get("subscription")
        if subscription_id:
            stripe_sub = stripe.Subscription.retrieve(
                subscription_id, expand=["latest_invoice.payment_intent.latest_charge"]
            )
            user, plan = _upsert_subscription(db, stripe_sub)
            if user is not None and plan is not None:
                _send_subscription_confirmation(user, plan)
            _attach_risk_signals(db, checkout_session_id, stripe_sub)
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


def _extract_risk_signals(stripe_sub) -> dict:
    """Best-effort extraction of 3DS/CVC/AVS results from a Subscription retrieved with
    expand=["latest_invoice.payment_intent.latest_charge"]. Every level is read with .get(...)
    so a missing/differently-shaped field never raises — this is dispute evidence, not
    something that should ever block subscription activation."""
    invoice = stripe_sub.get("latest_invoice") or {}
    payment_intent = invoice.get("payment_intent") if isinstance(invoice, dict) else None
    charge = (payment_intent or {}).get("latest_charge") if isinstance(payment_intent, dict) else None
    card = ((charge or {}).get("payment_method_details") or {}).get("card") or {}
    checks = card.get("checks") or {}
    three_d_secure = card.get("three_d_secure") or {}

    return {
        "stripe_charge_id": (charge or {}).get("id"),
        "three_ds_result": three_d_secure.get("result"),
        "cvc_check": checks.get("cvc_check"),
        "avs_line1_check": checks.get("address_line1_check"),
        "avs_postal_check": checks.get("address_postal_code_check"),
    }


def _attach_risk_signals(db: Session, checkout_session_id: str | None, stripe_sub) -> None:
    if not checkout_session_id:
        return
    try:
        attempt = (
            db.query(CheckoutAttempt)
            .filter(CheckoutAttempt.stripe_checkout_session_id == checkout_session_id)
            .first()
        )
        if attempt is None:
            logger.info("No CheckoutAttempt found for session %s, skipping risk signals", checkout_session_id)
            return

        signals = _extract_risk_signals(stripe_sub)
        attempt.stripe_subscription_id = stripe_sub.get("id")
        attempt.stripe_charge_id = signals["stripe_charge_id"]
        attempt.three_ds_result = signals["three_ds_result"]
        attempt.cvc_check = signals["cvc_check"]
        attempt.avs_line1_check = signals["avs_line1_check"]
        attempt.avs_postal_check = signals["avs_postal_check"]
        attempt.completed_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        logger.exception("Failed to attach risk signals for checkout session %s", checkout_session_id)


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
