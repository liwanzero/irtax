import stripe

from app.core.config import settings

if settings.stripe_enabled:
    stripe.api_key = settings.stripe_secret_key


def create_customer(email: str) -> str | None:
    if not settings.stripe_enabled:
        return None
    customer = stripe.Customer.create(email=email)
    return customer.id


def create_checkout_session(customer_id: str, price_id: str, user_id: int) -> str:
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        subscription_data={"trial_period_days": 30},
        success_url=f"{settings.frontend_url}/facturacion?checkout=success",
        cancel_url=f"{settings.frontend_url}/facturacion?checkout=cancelled",
        client_reference_id=str(user_id),
    )
    return session.url


def create_product_and_price(name: str, price_cents: int) -> str | None:
    """Creates a Stripe Product + monthly recurring Price for a paid plan. Returns the price id."""
    if not settings.stripe_enabled:
        return None
    product = stripe.Product.create(name=f"irtax {name}")
    price = stripe.Price.create(
        product=product.id,
        unit_amount=price_cents,
        currency="usd",
        recurring={"interval": "month"},
    )
    return price.id


def create_billing_portal_session(customer_id: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.frontend_url}/facturacion",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str):
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
