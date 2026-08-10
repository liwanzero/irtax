from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rate_limit import _client_ip, rate_limit
from app.db.session import get_db
from app.models.checkout_attempt import CheckoutAttempt
from app.models.plan import Plan
from app.models.user import User
from app.schemas.billing import CheckoutRequest, PlanOut
from app.services import stripe_service

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).order_by(Plan.price_cents).all()


@router.get("/config")
def billing_config():
    return {"stripe_enabled": settings.stripe_enabled, "publishable_key": settings.stripe_publishable_key}


@router.post("/checkout", dependencies=[rate_limit("checkout", max_requests=5, window_seconds=3600)])
def create_checkout(
    payload: CheckoutRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not settings.stripe_enabled:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Los pagos no están configurados todavía")

    plan = db.get(Plan, payload.plan_id)
    if plan is None or not plan.stripe_price_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Plan inválido para checkout (¿es el plan gratis?)")

    if not user.stripe_customer_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El usuario no tiene un cliente de Stripe asociado")

    session = stripe_service.create_checkout_session(user.stripe_customer_id, plan.stripe_price_id, user.id)
    db.add(
        CheckoutAttempt(
            user_id=user.id,
            stripe_checkout_session_id=session.id,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.commit()
    return {"url": session.url}


@router.post("/portal")
def create_portal(user: User = Depends(get_current_user)):
    if not settings.stripe_enabled:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Los pagos no están configurados todavía")
    if not user.stripe_customer_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El usuario no tiene un cliente de Stripe asociado")

    url = stripe_service.create_billing_portal_session(user.stripe_customer_id)
    return {"url": url}
